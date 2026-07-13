import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { createServerSupabase, createServiceSupabase, TENANT_ID } from '../lib/supabase-server'
import { syntheticAuthEmail } from '../lib/auth-email'
import { sendEmail, emailBienvenidaCliente, emailConfirmacionRegistro } from '../lib/email'

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) { console.warn('TURNSTILE_SECRET_KEY no configurada'); return true }
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })
  const data = await res.json()
  console.log('[turnstile] verify result:', JSON.stringify(data))
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

    const service = createServiceSupabase()         // para DB + admin auth
    const tenantId = TENANT_ID()
    const normalizedEmail = String(email).trim().toLowerCase()
    console.log(`[registro] inicio — email=${normalizedEmail}, tipo=${tipo}, tenantId=${tenantId}`)

    // En multi-tenant usamos el host del request para que cada tienda apunte a su propio dominio.
    // NEXT_PUBLIC_APP_URL se ignora acá porque es build-time y sería el mismo para todos los tenants.
    const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
    const siteUrl = host ? `https://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')

    // ── ¿Ya existe un customer con este email EN ESTA TIENDA? ──────────────────
    // Se chequea ANTES de tocar Supabase Auth. El mail que le mandamos a Auth
    // está "disfrazado" por tienda (ver lib/auth-email.ts), así que Auth nunca va
    // a decirnos "ya existe" para un email legítimamente nuevo acá aunque ya se
    // haya usado en otra tienda — la fuente de verdad sobre si esta persona YA es
    // cliente de ESTA tienda es la tabla customers, no Supabase Auth.
    const { data: existingRows } = await service
      .from('customers')
      .select('id, auth_user_id')
      .eq('tenant_id', tenantId)
      .eq('email', normalizedEmail)
      .limit(1)
    const existingCustomer = existingRows?.[0]

    if (existingCustomer?.auth_user_id) {
      return NextResponse.json({ error: 'Ya tenés una cuenta en esta tienda. Iniciá sesión.' }, { status: 409 })
    }

    // Mail disfrazado: cada tienda tiene su propia cuenta de Auth independiente
    // (propia contraseña) aunque el cliente use el mismo mail real en todas.
    const syntheticEmail = syntheticAuthEmail(tenantId, normalizedEmail)

    // Usar admin.generateLink en lugar de signUp:
    // - Crea el usuario sin que Supabase envíe su propio email de confirmación
    // - Devuelve el link de confirmación para que lo mandemos nosotros con branding de la tienda
    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'signup',
      email: syntheticEmail,
      password,
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
        data: { full_name: `${nombre} ${apellido ?? ''}`.trim(), tipo, real_email: normalizedEmail },
      },
    })
    console.log(`[registro] generateLink → user=${linkData?.user?.id ?? 'null'}, error=${linkError?.message ?? 'none'}`)

    let userId: string
    let confirmationUrl: string | undefined
    let needsConfirmation = true

    if (linkError) {
      const msg = linkError.message ?? ''
      if (msg.includes('already registered') || msg.includes('email_exists') || msg.includes('already been registered')) {
        // Caso borde (carrera entre dos registros simultáneos, o quedó una cuenta
        // de Auth disfrazada sin customer vinculado) — intentamos login antes de
        // rendirnos, en vez de fallar directo.
        const supabase = await createServerSupabase()
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password })
        if (signInError || !signInData.user)
          return NextResponse.json({ error: 'Ya tenés una cuenta en esta tienda. Iniciá sesión.' }, { status: 409 })
        userId = signInData.user.id
        needsConfirmation = false
      } else {
        return NextResponse.json({ error: linkError.message }, { status: 400 })
      }
    } else if (!linkData?.user) {
      return NextResponse.json({ error: 'Error al crear la cuenta. Intentá de nuevo.' }, { status: 500 })
    } else {
      userId = linkData.user.id
      // Usar hashed_token para construir nuestra propia URL de verificación.
      // action_link redirige a través de Supabase y llega con tokens en el hash URL
      // que los server route handlers no pueden leer. Con hashed_token + verifyOtp()
      // todo sucede server-side sin hash fragments.
      const hashedToken = linkData.properties?.hashed_token
      if (hashedToken) {
        confirmationUrl = `${siteUrl}/auth/verificar?token_hash=${encodeURIComponent(hashedToken)}&type=signup`
      } else {
        // Fallback: si por alguna razón no hay hashed_token, usar action_link
        confirmationUrl = linkData.properties?.action_link
      }
      // Si el usuario ya estaba confirmado (email_confirm desactivado en Supabase),
      // no hay confirmación pendiente
      needsConfirmation = !!confirmationUrl && !linkData.user.email_confirmed_at
    }

    if (existingCustomer) {
      // Customer importado (WooCommerce u otro), sin cuenta de login todavía —
      // primera vez que se registra de verdad. Actualizamos SIN tocar el id.
      const { error: updateErr } = await service.from('customers').update({
        full_name: nombre,
        last_name: apellido ?? null,
        type: tipo,
        company_name: empresa ?? null,
        cuit: cuit ?? null,
        auth_user_id: userId,
        ...(direccion ? { address_street: direccion } : {}),
        ...(provincia ? { address_province: provincia } : {}),
        ...(localidad ? { address_city: localidad } : {}),
        active: true,
      }).eq('id', existingCustomer.id).eq('tenant_id', tenantId)
      if (updateErr) console.error('[registro] error actualizando customer existente:', updateErr.message)
    } else {
      // id es propio de esta fila/tienda — NUNCA reutilizamos el id de auth acá,
      // porque una misma persona (mismo auth_user_id) puede tener una fila de
      // customer distinta en cada tienda de la plataforma. auth_user_id es el
      // vínculo real con la cuenta de login.
      const { error: insertErr } = await service.from('customers').insert({
        id: randomUUID(), tenant_id: tenantId, email: normalizedEmail, auth_user_id: userId,
        full_name: nombre, last_name: apellido ?? null,
        company_name: empresa ?? null, cuit: cuit ?? null,
        phone: null, type: tipo,
        address_street: direccion ?? null,
        address_province: provincia ?? null,
        address_city: localidad ?? null,
        active: true,
      })
      if (insertErr) {
        console.error('[registro] INSERT error:', insertErr.message, insertErr.code, JSON.stringify(insertErr.details))
        if (insertErr.code === '23505') {
          return NextResponse.json({
            error: 'Ya tenés una cuenta registrada con este email en esta tienda. Iniciá sesión, o escribinos si el problema persiste.',
          }, { status: 409 })
        }
        return NextResponse.json({ error: 'No se pudo completar el registro. Intentá de nuevo o contactanos.' }, { status: 500 })
      } else {
        console.log(`[registro] customer insertado OK — auth_user_id=${userId}, tipo=${tipo}`)
      }
    }

    // Datos del tenant para el email
    const [{ data: tenant }, { data: emailConfig }] = await Promise.all([
      service.from('tenants').select('name').eq('id', tenantId).single(),
      service.from('store_config').select('email_from_name, reply_to').eq('tenant_id', tenantId).single(),
    ])
    const storeName = tenant?.name ?? 'Tienda'
    const emailOpts = {
      fromName: emailConfig?.email_from_name ?? storeName,
      ...(emailConfig?.reply_to ? { replyTo: emailConfig.reply_to } : {}),
    }

    if (needsConfirmation && confirmationUrl) {
      // Enviar email de confirmación con branding de la tienda (en lugar del email genérico de Supabase)
      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: `Confirmá tu cuenta en ${storeName}`,
        html: emailConfirmacionRegistro({ storeName, firstName: nombre, confirmationUrl, storeUrl: siteUrl }),
        ...emailOpts,
      }).catch(e => { console.error('[email confirmacion] error:', e); return { ok: false } })
      console.log(`[registro] email confirmacion a ${normalizedEmail}: ${emailResult.ok ? 'ENVIADO OK' : 'FALLO'}`)
    } else {
      // Usuario ya confirmado (email_confirm desactivado) → enviar bienvenida directamente
      const emailResult = await sendEmail({
        to: normalizedEmail,
        subject: `Bienvenido/a a ${storeName}`,
        html: emailBienvenidaCliente({ storeName, firstName: nombre, storeUrl: siteUrl }),
        ...emailOpts,
      }).catch(e => { console.error('[email bienvenida] error:', e); return { ok: false } })
      console.log(`[registro] email bienvenida a ${normalizedEmail}: ${emailResult.ok ? 'ENVIADO OK' : 'FALLO'}`)
    }

    return NextResponse.json({ ok: true, confirmacion: needsConfirmation })
  } catch (err: any) {
    console.error('Error registro:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
