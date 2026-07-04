import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase, TENANT_ID } from '../lib/supabase-server'
import { sendEmail, emailBienvenidaCliente } from '../lib/email'

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) { console.warn('TURNSTILE_SECRET_KEY no configurada'); return true }
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })
  const data = await res.json()
  return data.success === true
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nombre, apellido, email, password, tipo, empresa, cuit, direccion, provincia, localidad, turnstileToken } = body
    if (!nombre || !email || !password || !tipo)
      return NextResponse.json({ error: 'Faltan campos obligatorios' }, { status: 400 })
    if (password.length < 8)
      return NextResponse.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 })
    if (tipo === 'wholesale' && (!empresa || !cuit))
      return NextResponse.json({ error: 'Empresa y CUIT son obligatorios para cuentas mayoristas' }, { status: 400 })
    if (tipo === 'wholesale' && (!direccion || !provincia || !localidad))
      return NextResponse.json({ error: 'Dirección, provincia y localidad son obligatorias' }, { status: 400 })
    if (!turnstileToken)
      return NextResponse.json({ error: 'Verificación de seguridad requerida' }, { status: 400 })
    if (!await verifyTurnstile(turnstileToken))
      return NextResponse.json({ error: 'Verificación de seguridad fallida. Intentá de nuevo.' }, { status: 400 })

    const supabase = await createServerSupabase()  // solo para auth (signUp/signIn)
    const service = createServiceSupabase()         // para DB: bypasea RLS
    const tenantId = TENANT_ID()
    console.log(`[registro] inicio — email=${email}, tipo=${tipo}, tenantId=${tenantId}`)

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${req.headers.get('host')}`
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: `${nombre} ${apellido ?? ''}`.trim(), tipo },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    })
    console.log(`[registro] signUp → user=${authData?.user?.id ?? 'null'}, session=${!!authData?.session}, error=${authError?.message ?? 'none'}`)

    let userId: string

    if (authError?.message.includes('already registered')) {
      // Email confirmation OFF: Supabase retorna error explícito
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError || !signInData.user)
        return NextResponse.json(
          { error: 'Ya existe una cuenta con ese email. Si ya compraste en otra tienda CreArt, usá la misma contraseña — o iniciá sesión.' },
          { status: 409 }
        )
      userId = signInData.user.id
      const { data: existing } = await service.from('customers').select('id').eq('id', userId).eq('tenant_id', tenantId).maybeSingle()
      if (existing)
        return NextResponse.json({ error: 'Ya tenés una cuenta en esta tienda. Iniciá sesión.' }, { status: 409 })
    } else if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    } else if (!authData.user) {
      // Email confirmation ON + email ya existía: Supabase retorna user=null sin error
      // (email enumeration protection). Buscar customer existente por email.
      const { data: existingCust } = await service.from('customers').select('id').eq('email', email).eq('tenant_id', tenantId).limit(1)
      console.log(`[registro] user=null (email ya existía), customer existente=${existingCust?.length ?? 0}`)
      if (existingCust && existingCust.length > 0) {
        return NextResponse.json({ error: 'Ya tenés una cuenta en esta tienda. Revisá tu email para confirmarla o iniciá sesión.' }, { status: 409 })
      }
      // El auth user existe pero el customer no — buscar userId via admin
      const { data: { users: adminUsers } } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existingAuthUser = adminUsers?.find((u: any) => u.email === email)
      if (!existingAuthUser) return NextResponse.json({ error: 'Error al procesar el registro. Intentá de nuevo.' }, { status: 500 })
      userId = existingAuthUser.id
      console.log(`[registro] auth user encontrado via admin: ${userId}`)
    } else {
      userId = authData.user.id
    }

    // Verificar si ya existe un customer con este email (importado de WooCommerce u otra tienda)
    const { data: existingByEmail } = await service
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .limit(1)

    if (existingByEmail && existingByEmail.length > 0) {
      // Existe un customer (importado u otro) → actualizar tipo y datos SIN tocar el id
      // No cambiamos el id para evitar FK constraint violation (orders.customer_id → customers.id)
      const { error: updateErr } = await service.from('customers').update({
        full_name: nombre,
        last_name: apellido ?? null,
        type: tipo,
        company_name: empresa ?? null,
        cuit: cuit ?? null,
        ...(direccion ? { address_street: direccion } : {}),
        ...(provincia ? { address_province: provincia } : {}),
        ...(localidad ? { address_city: localidad } : {}),
        active: true,
      }).eq('id', existingByEmail[0].id).eq('tenant_id', tenantId)
      if (updateErr) console.error('[registro] error actualizando customer existente:', updateErr.message)
    } else {
      // No existe → insertar nuevo (service client bypasea RLS del INSERT)
      const { error: insertErr } = await service.from('customers').insert({
        id: userId, tenant_id: tenantId, email,
        full_name: nombre, last_name: apellido ?? null,
        company_name: empresa ?? null, cuit: cuit ?? null,
        phone: null, type: tipo,
        address_street: direccion ?? null,
        address_province: provincia ?? null,
        address_city: localidad ?? null,
        active: true,
      })
      if (insertErr) console.error('[registro] INSERT error:', insertErr.message, insertErr.code, JSON.stringify(insertErr.details))
      else console.log(`[registro] customer insertado OK — id=${userId}, tipo=${tipo}`)
    }

    // Email de bienvenida
    const [{ data: tenant }, { data: emailConfig }] = await Promise.all([
      supabase.from('tenants').select('name').eq('id', tenantId).single(),
      supabase.from('store_configs').select('email_from_name, reply_to').eq('tenant_id', tenantId).single(),
    ])
    const storeName = tenant?.name ?? 'Tienda'
    const needsConfirmation = !authData?.session
    const emailResult = await sendEmail({
      to: email,
      subject: `Bienvenido/a a ${storeName}`,
      html: emailBienvenidaCliente({ storeName, firstName: nombre, storeUrl: siteUrl }),
      fromName: emailConfig?.email_from_name ?? storeName,
      ...(emailConfig?.reply_to ? { replyTo: emailConfig.reply_to } : {}),
    }).catch(e => { console.error('[email bienvenida] fetch error:', e); return { ok: false } })
    console.log(`[registro] email bienvenida a ${email}: ${emailResult.ok ? 'ENVIADO OK' : 'FALLO'}, confirmacion auth: ${needsConfirmation}`)

    return NextResponse.json({ ok: true, confirmacion: needsConfirmation })
  } catch (err: any) {
    console.error('Error registro:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
