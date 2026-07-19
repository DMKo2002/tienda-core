import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { TENANT_ID, createServiceSupabase } from '../lib/supabase-server'

/**
 * Crea el pago real a partir del token que generó el Card Payment Brick en
 * el frontend (tokenización de tarjeta con la Public Key). Es el equivalente
 * "Bricks" de mp-preferencia.ts (que arma el Checkout Pro con redirect).
 *
 * El monto NUNCA se toma del cliente — se lee de la fila `orders` ya creada
 * por /api/checkout/crear-pedido, mismo criterio que el resto del checkout
 * (shipping, precios, etc. también se recalculan server-side).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { order_id, token, payment_method_id, issuer_id, installments, payer } = body

    if (!order_id || !token || !payment_method_id) {
      return NextResponse.json({ error: 'Faltan datos del pago' }, { status: 400 })
    }

    // Mismo motivo que en mp-preferencia.ts: mp_access_token es sensible y
    // store_config tiene policy pública de lectura para anon (logo/colores/etc),
    // así que se lee con el service client para no depender de permisos de anon.
    const supabase = createServiceSupabase()

    const [{ data: config }, { data: order }] = await Promise.all([
      supabase.from('store_config').select('mp_access_token, mp_enabled').eq('tenant_id', TENANT_ID()).single(),
      supabase.from('orders').select('id, tenant_id, total, payment_status').eq('id', order_id).single(),
    ])

    if (!config?.mp_enabled) {
      return NextResponse.json({ error: 'MercadoPago no está habilitado' }, { status: 400 })
    }

    const accessToken = config?.mp_access_token
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Configurá tu Access Token de MercadoPago en Panel Admin → Mi tienda → Medios de pago' },
        { status: 400 }
      )
    }

    if (!order || order.tenant_id !== TENANT_ID()) {
      return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 })
    }
    if (order.payment_status === 'paid') {
      return NextResponse.json({ error: 'Este pedido ya fue pagado' }, { status: 400 })
    }

    const client = new MercadoPagoConfig({ accessToken })
    const payment = new Payment(client)

    const panelUrl = process.env.NEXT_PUBLIC_PANEL_URL
    const notificationUrl = panelUrl ? `${panelUrl}/api/mp/webhook?tenant_id=${TENANT_ID()}` : undefined

    const result = await payment.create({
      body: {
        transaction_amount: Number(order.total),
        token,
        description: `Pedido ${String(order_id).slice(0, 8).toUpperCase()}`,
        installments: Number(installments) || 1,
        payment_method_id,
        issuer_id: issuer_id ? String(issuer_id) : undefined,
        payer: payer ? {
          email: payer.email,
          identification: payer.identification,
        } : undefined,
        external_reference: order_id,
        ...(notificationUrl && { notification_url: notificationUrl }),
        statement_descriptor: 'Tienda Online',
      },
      requestOptions: {
        // Clave de idempotencia por intento — evita que un reintento de red
        // (ej: doble click, timeout) cobre dos veces el mismo pago.
        idempotencyKey: randomUUID(),
      },
    })

    if (!notificationUrl) {
      console.warn('NEXT_PUBLIC_PANEL_URL no está seteada — MP no tiene notification_url y depende de config manual en su dashboard.')
    }

    return NextResponse.json({
      id: result.id,
      status: result.status,
      status_detail: result.status_detail,
    })

  } catch (error: any) {
    console.error('Error creando pago MP (Brick):', error)
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: 500 })
  }
}
