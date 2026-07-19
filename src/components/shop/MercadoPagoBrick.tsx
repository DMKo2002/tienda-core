'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window { MercadoPago?: any }
}

interface Props {
  publicKey: string
  amount: number
  orderId: string
  onApproved: () => void
  onPending: () => void
  onRejected: (detail?: string) => void
}

const CONTAINER_ID = 'mp-card-payment-brick'

// El script del SDK se carga una sola vez por página, incluso si el
// componente se monta/desmonta varias veces (ej: el usuario vuelve a
// "Elegí cómo pagar" y entra de nuevo a la tarjeta).
let sdkLoadPromise: Promise<void> | null = null
function loadMercadoPagoSdk(): Promise<void> {
  if (typeof window !== 'undefined' && window.MercadoPago) return Promise.resolve()
  if (sdkLoadPromise) return sdkLoadPromise
  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-mp-sdk]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar el SDK de MercadoPago')))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.dataset.mpSdk = 'true'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el SDK de MercadoPago'))
    document.body.appendChild(script)
  })
  return sdkLoadPromise
}

/**
 * Checkout Bricks — formulario de tarjeta embebido (sin redirect a MP).
 * Tokeniza la tarjeta en el browser con la Public Key y manda el token a
 * /api/mp/crear-pago, que crea el pago real con el Access Token (backend).
 */
export default function MercadoPagoBrick({ publicKey, amount, orderId, onApproved, onPending, onRejected }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const controllerRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false

    async function mount() {
      try {
        await loadMercadoPagoSdk()
        if (cancelled) return
        const MercadoPagoCtor = window.MercadoPago
        if (!MercadoPagoCtor) throw new Error('SDK de MercadoPago no disponible')
        const mp = new MercadoPagoCtor(publicKey, { locale: 'es-AR' })
        const bricksBuilder = mp.bricks()

        controllerRef.current = await bricksBuilder.create('cardPayment', CONTAINER_ID, {
          initialization: { amount },
          callbacks: {
            onReady: () => {},
            onError: (brickError: any) => {
              console.error('Brick error:', brickError)
              setError('Ocurrió un error cargando el formulario de pago. Recargá la página.')
            },
            onSubmit: (formData: any) => {
              setSubmitting(true)
              setError(null)
              return fetch('/api/mp/crear-pago', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: orderId,
                  token: formData.token,
                  payment_method_id: formData.payment_method_id,
                  issuer_id: formData.issuer_id,
                  installments: formData.installments,
                  payer: formData.payer,
                }),
              })
                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                  setSubmitting(false)
                  if (!ok) {
                    setError(data.error ?? 'No pudimos procesar el pago.')
                    return
                  }
                  if (data.status === 'approved') onApproved()
                  else if (data.status === 'in_process' || data.status === 'pending') onPending()
                  else onRejected(data.status_detail)
                })
                .catch((err: any) => {
                  setSubmitting(false)
                  setError(err.message ?? 'No pudimos procesar el pago.')
                })
            },
          },
        })
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? 'No se pudo cargar el formulario de pago.')
      }
    }

    mount()

    return () => {
      cancelled = true
      controllerRef.current?.unmount?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, amount, orderId])

  return (
    <div className="space-y-3">
      <div id={CONTAINER_ID} />
      {submitting && <p className="text-xs text-[var(--color-stone)]">Procesando pago...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
