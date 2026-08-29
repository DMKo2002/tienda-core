import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase, TENANT_ID } from '../lib/supabase-server'
import { sendEmail, emailArrepentimientoRecibido, emailArrepentimientoNuevaSolicitud } from '../lib/email'

// Boton de Arrepentimiento -- Res. 424/2020 / Ley 24.240 art. 34. Formulario
// publico (sin login) para que el Cliente Final de la tienda ejerza su
// derecho de revocacion sobre una compra. Inserta en withdrawal_requests via
// service role -- esa tabla no tiene policy de INSERT para anon a proposito
// (mismo criterio que billing_cancellation_feedback), asi que este es el
// unico camino para crear una solicitud.

async function resolveTurnstileSecret(service: ReturnType<typeof createServiceSupabase>, tenantId: string): Promise<string | undefined> {
  const { data: configRows } = await service
    .from('store_config')
    .select('turnstile_widget_id')
    .eq('tenant_id', tenantId)
    .limit(1)
  const widgetId = configRows?.[0]?.turnstile_widget_id
  if (!widgetId) return process.env.TURNSTILE_SECRET_KEY

  const { data: widgetRows } = await service
    .from('turnstile_widgets')
    .select('secret_key')
    .eq('id', widgetId)
    .limit(1)
  return widgetRows?.[0]?.secret_key ?? process.env.TURNSTILE_SECRET_KEY
}

async function verifyTurnstile(token: string, secret: string | undefined): Promise<boolean> {
  if (!secret) { console.warn('TURNSTILE_SECRET_KEY no configurada'); return true }
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token }),
  })
  const data = await res.json()
  return data.success === true
}

// Formato ARR-YYYYMMDD-XXXX -- ordenable por fecha a simple vista y facil de
// dictar por telefono. 4 caracteres alfanumericos alcanzan de sobra para no
// chocar en un mismo dia/tenant, y el insert reintenta si choca igual (la
// columna es unique).
function generateTrackingCode(): string {
  const date = new Date()
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `ARR-${yyyy}${mm}${dd}-${suffix}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customerName, customerEmail, customerPhone, orderNumber, reason, turnstileToken } = body

    if (!customerName || typeof customerName !== 'string' || !customerName.trim())
      return NextResponse.json({ error: 'Falta el nombre y apellido' }, { status: 400 })
    const email = typeof customerEmail === 'string' ? customerEmail.trim() : ''
    const phone = typeof customerPhone === 'string' ? customerPhone.trim() : ''
    if (!email && !phone)
      return NextResponse.json({ error: 'Dejanos un email o un telefono para contactarte' }, { status: 400 })

    const service = createServiceSupabase()
    const tenantId = TENANT_ID()
    if (!tenantId)
      return NextResponse.json({ error: 'Tienda no identificada' }, { status: 400 })

    if (!turnstileToken)
      return NextResponse.json({ error: 'Verificacion de seguridad requerida' }, { status: 400 })
    const turnstileSecret = await resolveTurnstileSecret(service, tenantId)
    if (!await verifyTurnstile(turnstileToken, turnstileSecret))
      return NextResponse.json({ error: 'Verificacion de seguridad fallida. Intenta de nuevo.' }, { status: 400 })

    // Reintenta si el tracking_code (aleatorio) choca con uno existente --
    // con 4 caracteres alfanumericos por dia la probabilidad es minima, pero
    // la columna es unique asi que un choque tira error de Postgres, no un
    // 500 silencioso.
    let trackingCode = ''
    let insertError: any = null
    for (let attempt = 0; attempt < 3; attempt++) {
      trackingCode = generateTrackingCode()
      const { error } = await service.from('withdrawal_requests').insert({
        tenant_id: tenantId,
        order_number: orderNumber || null,
        customer_name: customerName.trim(),
        customer_email: email || null,
        customer_phone: phone || null,
        reason: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 2000) : null,
        tracking_code: trackingCode,
      })
      if (!error) { insertError = null; break }
      insertError = error
      if (error.code !== '23505') break // no es choque de unique, no reintentar
    }
    if (insertError) {
      console.error('[arrepentimiento] error guardando la solicitud:', insertError.message)
      return NextResponse.json({ error: 'No se pudo registrar la solicitud. Intenta de nuevo.' }, { status: 500 })
    }

    // Mails best-effort -- la solicitud ya quedo guardada con su codigo de
    // tramite igual, aunque el mail falle.
    const [{ data: tenantRow }, { data: storeConf }] = await Promise.all([
      service.from('tenants').select('name').eq('id', tenantId).single(),
      service.from('store_config').select('notification_email, email_from_name, reply_to').eq('tenant_id', tenantId).single(),
    ])
    const storeName = tenantRow?.name ?? 'Tienda'
    const emailFromName = (storeConf as any)?.email_from_name ?? storeName
    const replyTo = (storeConf as any)?.reply_to ?? undefined
    const ownerEmail = (storeConf as any)?.notification_email

    const emailTasks: Promise<any>[] = []
    if (email) {
      emailTasks.push(
        sendEmail({
          to: email,
          subject: `Recibimos tu solicitud — ${storeName}`,
          html: emailArrepentimientoRecibido({ storeName, customerName: customerName.trim(), trackingCode, orderNumber: orderNumber || null }),
          fromName: emailFromName,
          replyTo,
        }).catch(e => console.error('[arrepentimiento] error mail cliente:', e))
      )
    }
    if (ownerEmail) {
      emailTasks.push(
        sendEmail({
          to: ownerEmail,
          subject: `Nueva solicitud de arrepentimiento — ${storeName}`,
          html: emailArrepentimientoNuevaSolicitud({
            storeName, trackingCode, customerName: customerName.trim(),
            customerEmail: email || null, customerPhone: phone || null,
            orderNumber: orderNumber || null, reason: typeof reason === 'string' ? (reason.trim() || null) : null,
          }),
          fromName: emailFromName,
        }).catch(e => console.error('[arrepentimiento] error mail dueño:', e))
      )
    }
    await Promise.all(emailTasks)

    return NextResponse.json({ ok: true, trackingCode })
  } catch (e) {
    console.error('[arrepentimiento] error inesperado:', e)
    return NextResponse.json({ error: 'Error inesperado. Intenta de nuevo.' }, { status: 500 })
  }
}
