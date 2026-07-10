// Utilidad de email usando Resend (https://resend.com)
// Setup: https://resend.com/signup → crear API key → agregar al .env.local
// RESEND_API_KEY=re_xxxxx
// EMAIL_FROM=pedidos@tu-dominio.com  (el dominio debe estar verificado en Resend)
// Para testing sin dominio propio podés usar: EMAIL_FROM=onboarding@resend.dev

const RESEND_API_URL = 'https://api.resend.com/emails'

export async function sendEmail({
  to,
  subject,
  html,
  from,
  fromName,
  replyTo,
}: {
  to: string
  subject: string
  html: string
  from?: string
  fromName?: string   // nombre del remitente, ej: "Connors Store"
  replyTo?: string    // reply-to, ej: contacto@connors.com
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY no configurada — email omitido')
    return { ok: false }
  }
  const baseFrom = from ?? process.env.EMAIL_FROM ?? 'noreply@gounuri.com'
  // Si hay nombre de remitente: "Connors Store <noreply@gounuri.com>"
  const sender = fromName ? `${fromName} <${baseFrom}>` : baseFrom
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: sender,
        to,
        subject,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!res.ok) console.error('[email] Resend error:', await res.text())
    return { ok: res.ok }
  } catch (e: any) {
    console.error('[email] fetch error:', e.message)
    return { ok: false }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

type OrderItem = {
  productName: string
  variantDesc?: string | null
  quantity: number
  unitPrice: number
}

// ── Email al cliente ─────────────────────────────────────────────────────────

export function emailConfirmacionCliente({
  storeName,
  orderId,
  customerName,
  items,
  subtotal,
  shippingCost,
  total,
  shippingLabel,
  paymentMethod,
}: {
  storeName: string
  orderId: string
  customerName: string
  items: OrderItem[]
  subtotal: number
  shippingCost: number
  total: number
  shippingLabel: string
  paymentMethod: string
}): string {
  const shortId = orderId.slice(0, 8).toUpperCase()
  const paymentLabel = paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Transferencia bancaria'

  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f0ece7;font-size:14px;color:#333;">
        ${i.productName}${i.variantDesc ? `<br><span style="font-size:12px;color:#888;">${i.variantDesc}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #f0ece7;text-align:center;font-size:14px;color:#555;">×${i.quantity}</td>
      <td style="padding:10px 0;border-bottom:1px solid #f0ece7;text-align:right;font-size:14px;color:#333;">${fmt(i.unitPrice * i.quantity)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f4f1;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f1;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;">

  <!-- Header -->
  <tr><td style="background:#1c1c1c;padding:32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:20px;letter-spacing:5px;font-weight:300;">${storeName.toUpperCase()}</p>
  </td></tr>

  <!-- Hero text -->
  <tr><td style="padding:40px 40px 8px;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;">Confirmación de pedido</p>
    <h1 style="margin:0 0 6px;font-size:30px;font-weight:300;color:#1c1c1c;">Gracias, ${customerName.split(' ')[0]}.</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#aaa;letter-spacing:1px;">Pedido #${shortId}</p>
    <p style="margin:0 0 32px;font-size:14px;color:#555;line-height:1.7;">
      Recibimos tu pedido y lo estamos procesando.<br>Te vamos a contactar para confirmar.
    </p>
  </td></tr>

  <!-- Items -->
  <tr><td style="padding:0 40px 32px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <thead>
        <tr style="border-bottom:2px solid #1c1c1c;">
          <th style="padding:8px 0;text-align:left;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:400;color:#888;">Producto</th>
          <th style="padding:8px 0;text-align:center;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:400;color:#888;">Cant.</th>
          <th style="padding:8px 0;text-align:right;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;font-weight:400;color:#888;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <!-- Totals -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#888;">Subtotal</td>
        <td style="padding:5px 0;text-align:right;font-size:13px;color:#888;">${fmt(subtotal)}</td>
      </tr>
      <tr>
        <td style="padding:5px 0;font-size:13px;color:#888;">Envío (${shippingLabel})</td>
        <td style="padding:5px 0;text-align:right;font-size:13px;color:#888;">${shippingCost > 0 ? fmt(shippingCost) : 'Gratis'}</td>
      </tr>
      <tr>
        <td style="padding:14px 0 6px;border-top:1px solid #e8e4df;font-size:18px;font-weight:400;color:#1c1c1c;">Total</td>
        <td style="padding:14px 0 6px;border-top:1px solid #e8e4df;text-align:right;font-size:18px;font-weight:400;color:#1c1c1c;">${fmt(total)}</td>
      </tr>
    </table>

    <!-- Details chips -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;background:#f7f4f1;padding:16px 20px;">
      <tr>
        <td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#aaa;padding:4px 0;">Pago</td>
        <td style="font-size:13px;color:#333;text-align:right;padding:4px 0;">${paymentLabel}</td>
      </tr>
      <tr>
        <td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#aaa;padding:4px 0;">Envío</td>
        <td style="font-size:13px;color:#333;text-align:right;padding:4px 0;">${shippingLabel}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px;text-align:center;border-top:1px solid #ede8e3;">
    <p style="margin:0;font-size:12px;color:#bbb;letter-spacing:1px;">${storeName.toUpperCase()} · GRACIAS POR TU COMPRA</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Email al dueño ───────────────────────────────────────────────────────────

export function emailNotificacionDueno({
  storeName,
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  items,
  subtotal,
  shippingCost,
  total,
  shippingLabel,
  paymentMethod,
  addressStreet,
  addressCity,
  addressProvince,
  addressZip,
}: {
  storeName: string
  orderId: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  items: OrderItem[]
  subtotal: number
  shippingCost: number
  total: number
  shippingLabel: string
  paymentMethod: string
  addressStreet?: string | null
  addressCity?: string | null
  addressProvince?: string | null
  addressZip?: string | null
}): string {
  const shortId = orderId.slice(0, 8).toUpperCase()
  const paymentLabel = paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Transferencia bancaria'
  const address = [addressStreet, addressCity, addressProvince, addressZip].filter(Boolean).join(', ')

  const rows = items.map(i => `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">
        ${i.productName}${i.variantDesc ? ` <span style="color:#999;">(${i.variantDesc})</span>` : ''}
      </td>
      <td style="padding:8px 0;font-size:13px;color:#555;text-align:center;border-bottom:1px solid #f0f0f0;">×${i.quantity}</td>
      <td style="padding:8px 0;font-size:13px;color:#333;text-align:right;border-bottom:1px solid #f0f0f0;">${fmt(i.unitPrice * i.quantity)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:30px 16px;">
<tr><td align="center">
<table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

  <!-- Header -->
  <tr><td style="background:#4f46e5;padding:20px 28px;">
    <p style="margin:0;color:#fff;font-size:15px;font-weight:600;">🛍️ Nuevo pedido — ${storeName}</p>
  </td></tr>

  <!-- Order headline -->
  <tr><td style="padding:28px 28px 0;">
    <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111;">Pedido #${shortId}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#666;">${fmt(total)} · ${paymentLabel}</p>

    <!-- Customer -->
    <div style="background:#f9f9f9;border-radius:4px;padding:16px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:11px;color:#999;letter-spacing:1px;text-transform:uppercase;">Cliente</p>
      <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#111;">${customerName}</p>
      <p style="margin:0 0 2px;font-size:13px;color:#555;">${customerEmail}</p>
      ${customerPhone ? `<p style="margin:0 0 2px;font-size:13px;color:#555;">${customerPhone}</p>` : ''}
      ${address ? `<p style="margin:0;font-size:13px;color:#555;">${address}</p>` : ''}
    </div>

    <!-- Items -->
    <p style="margin:0 0 8px;font-size:11px;color:#999;letter-spacing:1px;text-transform:uppercase;">Productos</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${rows}
      <tr>
        <td colspan="2" style="padding:10px 0 4px;border-top:2px solid #eee;font-size:13px;color:#999;">Subtotal</td>
        <td style="padding:10px 0 4px;border-top:2px solid #eee;text-align:right;font-size:13px;color:#999;">${fmt(subtotal)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:4px 0;font-size:13px;color:#999;">Envío (${shippingLabel})</td>
        <td style="padding:4px 0;text-align:right;font-size:13px;color:#999;">${shippingCost > 0 ? fmt(shippingCost) : 'Gratis'}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:10px 0 6px;font-size:17px;font-weight:700;color:#111;">Total</td>
        <td style="padding:10px 0 6px;text-align:right;font-size:17px;font-weight:700;color:#111;">${fmt(total)}</td>
      </tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="background:#f5f5f5;padding:14px 28px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#aaa;">Enviado automáticamente por tu tienda · ${storeName}</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Email pedido enviado / listo para retirar ────────────────────────────────

export function emailPedidoEnviado({
  storeName,
  orderId,
  customerName,
  tipo,
  trackingCode,
  customIntro,
}: {
  storeName: string
  orderId: string
  customerName: string
  tipo: 'enviado' | 'listo_retiro'
  trackingCode?: string | null
  customIntro?: string | null
}): string {
  const shortId = orderId.slice(0, 8).toUpperCase()
  const isEnvio = tipo === 'enviado'
  const titulo = isEnvio ? 'Tu pedido está en camino' : 'Tu pedido está listo para retirar'
  const icono = isEnvio ? '📦' : '🏪'
  const defaultIntro = isEnvio
    ? 'Tu pedido fue despachado y está en camino. Pronto lo recibís en la dirección indicada.'
    : 'Tu pedido ya está listo para retirar en nuestro local. Pasá cuando quieras.'

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f4f1;font-family:Georgia,'Times New Roman',serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4f1;padding:40px 16px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;">

  <tr><td style="background:#1c1c1c;padding:32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:20px;letter-spacing:5px;font-weight:300;">${storeName.toUpperCase()}</p>
  </td></tr>

  <tr><td style="padding:40px 40px 32px;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#aaa;">${icono} ${isEnvio ? 'Pedido enviado' : 'Listo para retirar'}</p>
    <h1 style="margin:0 0 6px;font-size:28px;font-weight:300;color:#1c1c1c;">${titulo}</h1>
    <p style="margin:0 0 28px;font-size:13px;color:#aaa;letter-spacing:1px;">Pedido #${shortId} · ${customerName.split(' ')[0]}</p>
    <p style="margin:0 0 20px;font-size:14px;color:#555;line-height:1.7;">
      ${customIntro ?? defaultIntro}
    </p>
    ${trackingCode ? `
    <div style="background:#f7f4f1;padding:14px 18px;margin-bottom:20px;">
      <p style="margin:0 0 4px;font-size:11px;color:#aaa;letter-spacing:1px;text-transform:uppercase;">Código de seguimiento</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:#1c1c1c;letter-spacing:2px;">${trackingCode}</p>
    </div>` : ''}
  </td></tr>

  <tr><td style="padding:24px;text-align:center;border-top:1px solid #ede8e3;">
    <p style="margin:0;font-size:12px;color:#bbb;letter-spacing:1px;">${storeName.toUpperCase()} · GRACIAS POR TU COMPRA</p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

// ── Email confirmación de registro ──────────────────────────────────────────

export function emailConfirmacionRegistro({
  storeName,
  firstName,
  confirmationUrl,
  storeUrl,
}: {
  storeName: string
  firstName: string
  confirmationUrl: string
  storeUrl: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="100%" style="max-width:520px;background:#fff;border-radius:2px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:36px 40px 32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:300;letter-spacing:0.25em;text-transform:uppercase;">${storeName}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px 40px 32px;">
    <p style="margin:0 0 20px;font-size:13px;color:#999;letter-spacing:0.15em;text-transform:uppercase;">Confirmá tu cuenta</p>
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:300;color:#1a1a1a;line-height:1.3;">Hola, ${firstName}</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7;">
      Gracias por registrarte en <strong>${storeName}</strong>. Para activar tu cuenta y empezar a comprar, confirmá tu dirección de email:
    </p>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:#1a1a1a;border-radius:2px;">
        <a href="${confirmationUrl}" style="display:block;padding:14px 32px;color:#fff;text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">
          Confirmar mi cuenta
        </a>
      </td>
    </tr></table>
    <p style="margin:28px 0 0;font-size:12px;color:#bbb;line-height:1.6;">
      Si no creaste esta cuenta, podés ignorar este email.<br>El link es válido por 24 horas.
    </p>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#bbb;letter-spacing:0.1em;">
      © ${storeName} · <a href="${storeUrl}" style="color:#bbb;text-decoration:underline;">${storeUrl.replace(/^https?:\/\//, '')}</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`
}

// ── Email recuperación de contraseña ─────────────────────────────────────────

export function emailRecuperarPassword({
  storeName,
  firstName,
  recoveryUrl,
  storeUrl,
}: {
  storeName: string
  firstName: string
  recoveryUrl: string
  storeUrl: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="100%" style="max-width:520px;background:#fff;border-radius:2px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:36px 40px 32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:300;letter-spacing:0.25em;text-transform:uppercase;">${storeName}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px 40px 32px;">
    <p style="margin:0 0 20px;font-size:13px;color:#999;letter-spacing:0.15em;text-transform:uppercase;">Recuperar contraseña</p>
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:300;color:#1a1a1a;line-height:1.3;">Hola, ${firstName}</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.7;">
      Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>${storeName}</strong>. Hacé click abajo para crear una nueva:
    </p>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:#1a1a1a;border-radius:2px;">
        <a href="${recoveryUrl}" style="display:block;padding:14px 32px;color:#fff;text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">
          Restablecer contraseña
        </a>
      </td>
    </tr></table>
    <p style="margin:28px 0 0;font-size:12px;color:#bbb;line-height:1.6;">
      Si no solicitaste este cambio, podés ignorar este email. El link es válido por 1 hora.
    </p>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#bbb;letter-spacing:0.1em;">
      © ${storeName} · <a href="${storeUrl}" style="color:#bbb;text-decoration:underline;">${storeUrl.replace(/^https?:\/\//, '')}</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`
}

// ── Email de bienvenida al cliente ───────────────────────────────────────────

export function emailBienvenidaCliente({
  storeName,
  firstName,
  storeUrl,
}: {
  storeName: string
  firstName: string
  storeUrl: string
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px;">
<table width="100%" style="max-width:520px;background:#fff;border-radius:2px;overflow:hidden;">

  <!-- Header -->
  <tr><td style="background:#1a1a1a;padding:36px 40px 32px;text-align:center;">
    <p style="margin:0;color:#fff;font-size:22px;font-weight:300;letter-spacing:0.25em;text-transform:uppercase;">${storeName}</p>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:40px 40px 32px;">
    <p style="margin:0 0 20px;font-size:13px;color:#999;letter-spacing:0.15em;text-transform:uppercase;">Bienvenida</p>
    <h1 style="margin:0 0 16px;font-size:28px;font-weight:300;color:#1a1a1a;line-height:1.3;">Hola, ${firstName}</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.7;">
      Tu cuenta en <strong>${storeName}</strong> fue creada exitosamente. Ya podés explorar nuestra colección y hacer tus pedidos de forma rápida.
    </p>
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="background:#1a1a1a;border-radius:2px;">
        <a href="${storeUrl}/tienda" style="display:block;padding:14px 32px;color:#fff;text-decoration:none;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;">
          Ver colección
        </a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Divider -->
  <tr><td style="padding:0 40px;"><div style="border-top:1px solid #f0f0f0;"></div></td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#bbb;letter-spacing:0.1em;">
      © ${storeName} · <a href="${storeUrl}/cuenta" style="color:#bbb;text-decoration:underline;">Mi cuenta</a>
    </p>
  </td></tr>

</table>
</td></tr></table>
</body>
</html>`
}
