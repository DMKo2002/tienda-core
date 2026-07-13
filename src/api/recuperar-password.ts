import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase, TENANT_ID } from '../lib/supabase-server'
import { sendEmail, emailRecuperarPassword } from '../lib/email'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const service = createServiceSupabase()
    const tenantId = TENANT_ID()
    const normalizedEmail = String(email).trim().toLowerCase()
    console.log('[recuperar] tenantId:', tenantId, 'email:', normalizedEmail)
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    const siteUrl = host ? `https://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

    // Verificar que el email pertenece a un customer de este tenant
    const { data: customer, error: customerErr } = await service
      .from('customers')
      .select('id, full_name, email, auth_user_id')
      .eq('tenant_id', tenantId)
      .eq('email', normalizedEmail)
      .limit(1)
    console.log('[recuperar] customer lookup:', customer?.length, 'err:', customerErr?.message)

    // Por seguridad, siempre respondemos OK aunque el email no exista o no tenga
    // cuenta de login todavía (ej. customer importado de WooCommerce que nunca
    // se registró) — no hay nada para "recuperar" en ese caso.
    if (!customer || customer.length === 0 || !customer[0].auth_user_id) {
      return NextResponse.json({ ok: true })
    }

    // El mail real (customers.email) puede no coincidir con el mail guardado en
    // Supabase Auth: las cuentas nuevas usan un mail "disfrazado" por tienda (ver
    // lib/auth-email.ts), las cuentas viejas todavía tienen el mail real tal cual.
    // En vez de adivinar cuál es, le preguntamos a Supabase directamente por el
    // auth_user_id — así funciona igual para los dos casos sin lógica de fallback.
    const { data: authUserData, error: authUserErr } = await service.auth.admin.getUserById(customer[0].auth_user_id)
    const authEmail = authUserData?.user?.email
    if (authUserErr || !authEmail) {
      console.error('[recuperar] no se pudo resolver el auth user:', authUserErr?.message)
      return NextResponse.json({ ok: true }) // no revelar si el usuario existe
    }

    // Generar link de recuperación via admin API
    console.log('[recuperar] calling generateLink...')
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'recovery',
      email: authEmail,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/cuenta/recuperar/confirmar`,
      },
    })
    console.log('[recuperar] generateLink result:', !!linkData?.properties?.action_link, 'err:', linkError?.message)

    if (linkError || !linkData?.properties) {
      console.error('[recuperar] generateLink error:', linkError?.message)
      return NextResponse.json({ ok: true }) // no revelar si el usuario existe
    }

    // Usar hashed_token para construir nuestra propia URL de verificación
    // (evita el problema de hash URL con action_link de Supabase)
    const hashedToken = linkData.properties.hashed_token
    const recoveryUrl = hashedToken
      ? `${siteUrl}/auth/verificar?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&next=${encodeURIComponent('/cuenta/recuperar/confirmar')}`
      : linkData.properties.action_link ?? siteUrl
    const firstName = customer[0].full_name?.split(' ')[0] ?? 'Hola'
    const realEmail = customer[0].email ?? normalizedEmail

    // Datos de la tienda para el email
    const [{ data: tenant }, { data: emailConfig }] = await Promise.all([
      service.from('tenants').select('name').eq('id', tenantId).single(),
      service.from('store_config').select('email_from_name, reply_to').eq('tenant_id', tenantId).single(),
    ])
    const storeName = tenant?.name ?? 'Tienda'
    console.log('[recuperar] storeName:', storeName, 'sendEmail a:', realEmail)
    const emailOpts = {
      fromName: emailConfig?.email_from_name ?? storeName,
      ...(emailConfig?.reply_to ? { replyTo: emailConfig.reply_to } : {}),
    }

    // El mail de recuperación SIEMPRE va al mail real de contacto — nunca al mail
    // disfrazado que usa Supabase Auth internamente (esa dirección no existe).
    await sendEmail({
      to: realEmail,
      subject: `Restablecer contraseña — ${storeName}`,
      html: emailRecuperarPassword({ storeName, firstName, recoveryUrl, storeUrl: siteUrl }),
      ...emailOpts,
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[recuperar] error:', err?.message ?? err, JSON.stringify(err))
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
