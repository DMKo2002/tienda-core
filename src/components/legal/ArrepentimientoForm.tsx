'use client'

import { useState, useEffect } from 'react'
import Turnstile from 'react-turnstile'
import { createClient, TENANT_ID } from '../../lib/supabase'

// Formulario del Boton de Arrepentimiento, compartido por todos los templates
// via @creart/tienda-core/ArrepentimientoForm. Cada tienda solo lo importa
// dentro de su propia pagina /arrepentimiento (que arma el resto de la pagina
// -- texto legal, Navbar, Footer -- con su propio estilo, ver src/app/empresa
// para el mismo patron). El envio va a POST /api/arrepentimiento, montado en
// cada template como un re-export de @creart/tienda-core/api/arrepentimiento.
export default function ArrepentimientoForm() {
  const [form, setForm] = useState({
    customerName: '', customerEmail: '', customerPhone: '', orderNumber: '', reason: '',
  })
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [turnstileSiteKey, setTurnstileSiteKey] = useState(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackingCode, setTrackingCode] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('store_config')
      .select('turnstile_site_key')
      .eq('tenant_id', TENANT_ID())
      .single()
      .then(({ data }) => {
        const siteKey = (data as any)?.turnstile_site_key
        if (siteKey) setTurnstileSiteKey(siteKey)
      })
  }, [])

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.customerName.trim()) {
      setError('Falta el nombre y apellido')
      return
    }
    if (!form.customerEmail.trim() && !form.customerPhone.trim()) {
      setError('Dejanos un email o un teléfono para contactarte')
      return
    }
    if (!turnstileToken) {
      setError('Completá la verificación de seguridad')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/arrepentimiento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          customerEmail: form.customerEmail.trim() || undefined,
          customerPhone: form.customerPhone.trim() || undefined,
          orderNumber: form.orderNumber.trim() || undefined,
          reason: form.reason.trim() || undefined,
          turnstileToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar la solicitud')
        setTurnstileToken(null)
        setTurnstileKey(k => k + 1)
        return
      }
      setTrackingCode(data.trackingCode)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (trackingCode) {
    return (
      <div className="border border-[var(--color-border)] p-8 text-center">
        <div className="w-14 h-14 bg-[var(--color-charcoal)] rounded-full flex items-center justify-center mx-auto mb-5">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-light text-[var(--color-charcoal)] mb-3">Solicitud recibida</h2>
        <p className="text-sm text-[var(--color-stone)] font-light leading-relaxed mb-5">
          Te vamos a contactar dentro de las próximas 24 horas
          {form.customerEmail.trim() && <> — también te lo confirmamos a <strong>{form.customerEmail.trim()}</strong></>}.
        </p>
        <div className="bg-[var(--color-bg)] py-4 px-6 inline-block">
          <p className="text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1">Código de trámite</p>
          <p className="text-lg font-medium text-[var(--color-charcoal)] tracking-wide">{trackingCode}</p>
        </div>
        <p className="text-xs text-[var(--color-stone)] mt-5">Guardá este código para hacer seguimiento de tu solicitud.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Nombre y apellido *</label>
        <input
          className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
          value={form.customerName} onChange={e => set('customerName', e.target.value)} required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Email</label>
          <input
            type="email"
            className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
            value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Teléfono</label>
          <input
            className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
            value={form.customerPhone} onChange={e => set('customerPhone', e.target.value)}
          />
        </div>
      </div>
      <p className="text-xs text-[var(--color-stone)] -mt-2">Dejanos al menos uno de los dos, para poder contactarte.</p>

      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Número de pedido (opcional)</label>
        <input
          className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
          value={form.orderNumber} onChange={e => set('orderNumber', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Motivo (opcional)</label>
        <textarea
          rows={3}
          className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors resize-y"
          value={form.reason} onChange={e => set('reason', e.target.value)}
        />
      </div>

      <div className="flex justify-center py-2">
        <Turnstile
          key={turnstileKey}
          sitekey={turnstileSiteKey}
          onVerify={token => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken(null)}
          theme="light"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || !turnstileToken}
        className="w-full py-3.5 bg-[var(--color-charcoal)] text-white text-[11px] tracking-[0.2em] uppercase hover:bg-[var(--color-stone)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
