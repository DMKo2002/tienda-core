import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase, TENANT_ID } from '../lib/supabase-server'
import { sendEmail, emailConfirmacionCliente, emailNotificacionDueno } from '../lib/email'
import { checkoutLimiter } from '../lib/ratelimit'

// El variantId en el carrito es una clave compuesta "uuid__talle__color"
// para distinguir misma variante en distintos colores/talles.
// En la DB siempre usamos solo el UUID real (parte antes del primer "__").
function realVariantId(compositeId: string): string {
  return compositeId.split('__')[0]
}

// Service role bypasa RLS — solo para operaciones server-side
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  // Rate limiting por IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  const { success } = await checkoutLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Demasiados intentos. Esperá unos segundos e intentá de nuevo.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const {
      firstName, lastName, fullName, email, phone,
      cuil,
      addressStreet, addressCity, addressProvince, addressZip,
      shippingMethod, notes, items,
      paymentMethod,
    } = body
    // NOTA: shippingCost y price NO se confían desde el cliente — se recalculan desde la DB

    if (!fullName || !email || !items?.length) {
      return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 })
    }

    const supabaseAuth = await createServerSupabase()
    const { data: { user } } = await supabaseAuth.auth.getUser()
    const supabase = createServiceClient()

    // ── 1. Fetch store config (envío + email notificación) ────────────────────
    const [{ data: storeConf }, { data: tenant }] = await Promise.all([
      supabase.from('store_config').select('custom_shipping, notification_email, email_from_name, reply_to, email_intro_pedido_recibido').eq('tenant_id', TENANT_ID()).single(),
      supabase.from('tenants').select('name').eq('id', TENANT_ID()).single(),
    ])

    const storeName = (tenant as any)?.name ?? 'Tienda'

    // ── 2. Validar costo de envío desde DB ────────────────────────────────────
    const customMethods = ((storeConf as any)?.custom_shipping ?? []).filter((m: any) => m.active && m.name)
    let validatedShippingCost = 0
    let shippingLabel = shippingMethod ?? ''

    if (shippingMethod?.startsWith('custom_')) {
      const idx = Number(shippingMethod.split('_')[1])
      const method = customMethods[idx]
      validatedShippingCost = method?.price ?? 0
      shippingLabel = method?.name ?? shippingMethod
    }

    // ── 3. Validar precios desde DB (ignorar precio enviado por el cliente) ───
    const variantIds = (items as any[]).map((i: any) => realVariantId(i.variantId)).filter(Boolean)

    if (variantIds.length === 0) {
      return NextResponse.json({ error: 'No se recibieron variantes válidas' }, { status: 400 })
    }

    const { data: priceRulesData, error: priceErr } = await supabase
      .from('price_rules')
      .select('variant_id, type, price, compare_at_price, min_qty, active')
      .in('variant_id', variantIds)
      .eq('active', true)

    if (priceErr) throw priceErr

    const validatedItems = (items as any[]).map((item: any) => {
      const vid = realVariantId(item.variantId)
      const rules = (priceRulesData ?? []).filter((r: any) => r.variant_id === vid)
      const retailRule = rules.find((r: any) => r.type === 'retail')
      const wholesaleRule = rules.find((r: any) => r.type === 'wholesale')

      let actualPrice: number
      let actualPriceType: 'retail' | 'wholesale'

      const qty = Number(item.quantity) || 1

      if (
        wholesaleRule &&
        item.priceType === 'wholesale' &&
        qty >= (wholesaleRule.min_qty ?? 1)
      ) {
        actualPrice = wholesaleRule.price
        actualPriceType = 'wholesale'
      } else if (retailRule) {
        // compare_at_price = precio rebajado (más bajo); si existe y es menor, cobrar ese
        actualPrice = (retailRule.compare_at_price > 0 && retailRule.compare_at_price < retailRule.price)
          ? retailRule.compare_at_price
          : retailRule.price
        actualPriceType = 'retail'
      } else if (wholesaleRule) {
        // Producto sin precio minorista — usar precio mayorista igual
        actualPrice = wholesaleRule.price
        actualPriceType = 'wholesale'
      } else {
        throw new Error(`Precio no encontrado para el producto "${item.productName}". Por favor recargá la página.`)
      }

      return {
        variantId: vid,  // UUID real, sin el composite key
        productName: String(item.productName ?? 'Producto'),
        variantDesc: item.variantDesc ?? null,
        quantity: qty,
        price: actualPrice,
        priceType: actualPriceType,
      }
    })

    // ── 4. Recalcular totales desde precios validados ─────────────────────────
    const subtotal = validatedItems.reduce((acc, i) => acc + i.price * i.quantity, 0)
    const total = subtotal + validatedShippingCost

    // ── 5. Customer upsert ────────────────────────────────────────────────────
    let customerId: string | null = null

    if (user) {
      customerId = user.id
      await supabase.from('customers').upsert({
        id: user.id,
        tenant_id: TENANT_ID(),
        email: user.email ?? email,
        full_name: firstName || fullName,
        last_name: lastName || null,
        cuit: cuil || null,
        phone: phone || null,
        address_street: addressStreet || null,
        address_city: addressCity || null,
        address_province: addressProvince || null,
        address_zip: addressZip || null,
      }, { onConflict: 'id', ignoreDuplicates: false })
    } else {
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', TENANT_ID())
        .eq('email', email.trim())
        .single()

      if (existing) {
        customerId = existing.id
      } else {
        const { data: newCustomer } = await supabase
          .from('customers')
          .insert({
            tenant_id: TENANT_ID(),
            email: email.trim(),
            full_name: (firstName || fullName).trim(),
            last_name: lastName?.trim() || null,
            cuit: cuil || null,
            phone: phone || null,
            address_street: addressStreet || null,
            address_city: addressCity || null,
            address_province: addressProvince || null,
            address_zip: addressZip || null,
            type: 'retail',
            active: true,
          })
          .select()
          .single()
        customerId = newCustomer?.id ?? null
      }
    }

    // ── 6. Crear pedido ───────────────────────────────────────────────────────
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: TENANT_ID(),
        customer_id: customerId,
        status: 'pending',
        payment_method: paymentMethod,
        payment_status: 'pending',
        subtotal,
        shipping_cost: validatedShippingCost,
        total,
        shipping_method: shippingMethod,
        shipping_address: {
          street: addressStreet,
          city: addressCity,
          province: addressProvince,
          zip: addressZip,
        },
        notes: notes || null,
      })
      .select()
      .single()

    if (orderError) throw orderError

    // ── 7. Crear items del pedido ─────────────────────────────────────────────
    const itemsPayload = validatedItems.map(item => ({
      order_id: order.id,
      variant_id: item.variantId ?? null,
      product_name: item.productName,
      variant_desc: item.variantDesc ?? null,
      quantity: item.quantity,
      unit_price: item.price,
      price_type: item.priceType,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsPayload)

    if (itemsError) {
      console.error('Error insertando order_items:', JSON.stringify(itemsError))
      return NextResponse.json(
        { error: 'Error guardando productos: ' + itemsError.message },
        { status: 500 }
      )
    }

    // ── 8. Emails (fire & forget — no bloquean la respuesta) ─────────────────
    const emailItems = validatedItems.map(i => ({
      productName: i.productName,
      variantDesc: i.variantDesc,
      quantity: i.quantity,
      unitPrice: i.price,
    }))

    const emailPayload = {
      storeName,
      orderId: order.id,
      customerName: fullName.trim(),
      items: emailItems,
      subtotal,
      shippingCost: validatedShippingCost,
      total,
      shippingLabel,
      paymentMethod,
    }

    const emailFromName    = (storeConf as any)?.email_from_name ?? storeName
    const replyTo          = (storeConf as any)?.reply_to ?? undefined
    const ownerEmail       = (storeConf as any)?.notification_email

    // Al cliente
    sendEmail({
      to: email.trim(),
      subject: `Tu pedido #${order.id.slice(0, 8).toUpperCase()} fue recibido — ${storeName}`,
      html: emailConfirmacionCliente({
        ...emailPayload,
        customIntro: (storeConf as any)?.email_intro_pedido_recibido ?? null,
      }),
      fromName: emailFromName,
      replyTo,
    }).then(({ ok }) => {
      supabase.from('notifications_log').insert({
        tenant_id: TENANT_ID(),
        order_id: order.id,
        channel: 'email',
        recipient: email.trim(),
        subject: `Confirmación pedido #${order.id.slice(0, 8).toUpperCase()}`,
        status: ok ? 'sent' : 'failed',
      })
    }).catch(e => console.error('[email cliente]', e))

    // Al dueño
    if (ownerEmail) {
      sendEmail({
        to: ownerEmail,
        subject: `🛍️ Nuevo pedido #${order.id.slice(0, 8).toUpperCase()} — ${storeName}`,
        html: emailNotificacionDueno({
          ...emailPayload,
          customerEmail: email.trim(),
          customerPhone: phone || null,
          addressStreet: addressStreet || null,
          addressCity: addressCity || null,
          addressProvince: addressProvince || null,
          addressZip: addressZip || null,
        }),
        fromName: emailFromName,
      }).then(({ ok }) => {
        supabase.from('notifications_log').insert({
          tenant_id: TENANT_ID(),
          order_id: order.id,
          channel: 'email',
          recipient: ownerEmail,
          subject: `Nuevo pedido #${order.id.slice(0, 8).toUpperCase()} — ${storeName}`,
          status: ok ? 'sent' : 'failed',
        })
      }).catch(e => console.error('[email dueño]', e))
    }

    return NextResponse.json({ ok: true, order })

  } catch (err: any) {
    console.error('Error crear pedido:', err)
    return NextResponse.json({ error: err.message ?? 'Error interno' }, { status: 500 })
  }
}
