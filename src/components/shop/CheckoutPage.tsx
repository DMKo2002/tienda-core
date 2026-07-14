'use client'

import { useState, useEffect, useRef, ComponentType } from 'react'
import { useCart } from './CartContext'
import { useCartValidation } from './useCartValidation'
import Link from 'next/link'
import { ArrowLeft, CreditCard, Building2, ImageOff, Check } from 'lucide-react'
import { createClient, TENANT_ID } from '../../lib/supabase'

const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
]

function LocalidadAutocomplete({ value, provincia, onChange, inputClass }: {
  value: string; provincia: string; onChange: (v: string) => void; inputClass: string
}) {
  const [query, setQuery] = useState(value)
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(''); onChange(''); setSugerencias([]) }, [provincia])
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleInput(v: string) {
    setQuery(v); onChange('')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!provincia || v.length < 2) { setSugerencias([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${encodeURIComponent(provincia)}&nombre=${encodeURIComponent(v)}&orden=nombre&max=8&campos=nombre`
        const res = await fetch(url)
        const data = await res.json()
        const nombres: string[] = [...new Set((data.localidades ?? []).map((l: any) => l.nombre))] as string[]
        setSugerencias(nombres); setOpen(nombres.length > 0)
      } catch { setSugerencias([]) } finally { setBuscando(false) }
    }, 300)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text" autoComplete="off"
        className={inputClass}
        placeholder={provincia ? 'Escribí para buscar...' : 'Primero elegí una provincia'}
        disabled={!provincia} value={query}
        onChange={e => handleInput(e.target.value)}
        onFocus={() => sugerencias.length > 0 && setOpen(true)}
      />
      {buscando && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" /></div>}
      {open && sugerencias.length > 0 && (
        <ul className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-[var(--color-border)] shadow-lg max-h-48 overflow-y-auto">
          {sugerencias.map(s => (
            <li key={s}>
              <button type="button" onMouseDown={() => { setQuery(s); onChange(s); setSugerencias([]); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm text-[var(--color-charcoal)] hover:bg-[#F2EEE9] transition-colors">
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

interface Branding {
  storeName: string
  logoUrl?: string
  whatsapp?: string
  email?: string
  instagramUrl?: string
  facebookUrl?: string
  tiktokUrl?: string
  branches?: any[]
}

export interface CheckoutPageProps {
  Navbar: ComponentType<any>
  Footer: ComponentType<any>
  shopHref?: string
  carritoHref?: string
}

/**
 * Página de Checkout compartida entre todos los templates.
 * Igual que CarritoPage: Navbar/Footer se inyectan como props (diseño propio
 * de cada template), pero toda la lógica del formulario, validación,
 * creación del pedido y pago vive acá, centralizada en tienda-core.
 *
 * Los campos de dirección (calle, provincia, localidad, CP, país) se
 * muestran siempre que el método de envío no sea "retiro" — independiente
 * de si el tenant configuró métodos de envío personalizados o no. Muchos
 * mayoristas despachan con un expreso propio y no cargan métodos de envío
 * en el panel, pero igual necesitan estos datos para imprimir etiquetas.
 */
export default function CheckoutPage({ Navbar, Footer, shopHref = '/tienda', carritoHref = '/carrito' }: CheckoutPageProps) {
  const { items, total, clearCart } = useCart()
  const supabase = createClient()

  const [step, setStep] = useState<'datos' | 'pago' | 'qr'>('datos')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [storeConfig, setStoreConfig] = useState<any>(null)
  const [branding, setBranding] = useState<Branding>({ storeName: 'Tienda' })
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null)
  const [orderTotal, setOrderTotal] = useState(0)
  const [emailLocked, setEmailLocked] = useState(false)
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)

  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [cuil, setCuil] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressProvince, setAddressProvince] = useState('')
  const [addressZip, setAddressZip] = useState('')
  const [country, setCountry] = useState('Argentina')
  const [shippingMethod, setShippingMethod] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  // Transporte elegido cuando el método de envío tiene una lista de transportes
  // configurada (ej: "Expreso / Contrareembolso"). 'Otro' revela un campo libre.
  const [carrierChoice, setCarrierChoice] = useState('')
  const [carrierOtherText, setCarrierOtherText] = useState('')
  const [notes, setNotes] = useState('')
  const [copied, setCopied] = useState<'alias' | 'cbu' | null>(null)

  useEffect(() => {
    const tenantId = TENANT_ID()

    // Cargar config de la tienda
    supabase.from('store_config')
      .select('mp_enabled, transfer_enabled, transfer_cbu, transfer_alias, whatsapp_number, min_order_amount, custom_shipping, logo_url, notification_email, instagram_url, facebook_url, tiktok_url, branches')
      .eq('tenant_id', tenantId)
      .single()
      .then(({ data }) => {
        setStoreConfig(data)
        const conf = data as any
        setBranding(b => ({
          ...b,
          logoUrl: conf?.logo_url ?? undefined,
          whatsapp: conf?.whatsapp_number ?? '',
          email: conf?.notification_email ?? '',
          instagramUrl: conf?.instagram_url ?? undefined,
          facebookUrl: conf?.facebook_url ?? undefined,
          tiktokUrl: conf?.tiktok_url ?? undefined,
          branches: conf?.branches ?? [],
        }))
        // Auto-select first active shipping method
        const methods = (conf?.custom_shipping ?? []).filter((m: any) => m.active && m.name)
        if (methods.length > 0) {
          setShippingMethod('custom_0')
          setShippingCost(methods[0].priceOnRequest ? 0 : (methods[0].price ?? 0))
        }
      })

    supabase.from('tenants').select('name').eq('id', tenantId).single()
      .then(({ data }) => {
        if (data?.name) setBranding(b => ({ ...b, storeName: data.name }))
      })

    // Pre-llenar datos del usuario registrado. Buscamos por auth_user_id (no
    // email): el mail de Auth puede ser "disfrazado" por tienda (ver
    // lib/auth-email.ts) y ya no coincide con customers.email para cuentas
    // nuevas — el mail real de contacto vive en customers.email.
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return

      const { data: cust } = await supabase
        .from('customers')
        .select('email, full_name, last_name, cuit, phone, address_street, address_city, address_province')
        .eq('auth_user_id', user.id)
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (cust?.email) {
        setEmail(cust.email)
        setEmailLocked(true)
      }
      if (cust) {
        if (cust.full_name) setNombre(cust.full_name)
        if (cust.last_name) setApellido(cust.last_name)
        if (cust.cuit) setCuil(cust.cuit)
        if (cust.phone) setPhone(cust.phone)
        if (cust.address_street) setAddressStreet(cust.address_street)
        if (cust.address_city) setAddressCity(cust.address_city)
        if (cust.address_province) setAddressProvince(cust.address_province)
      }
    })
  }, [])

  const activeCustomMethods: any[] = ((storeConfig as any)?.custom_shipping ?? []).filter((m: any) => m.active && m.name)
  const selectedMethodIdx = shippingMethod.startsWith('custom_') ? Number(shippingMethod.split('_')[1]) : -1
  const selectedMethod = selectedMethodIdx >= 0 ? activeCustomMethods[selectedMethodIdx] : null
  const selectedMethodCarriers: string[] = selectedMethod?.carriers ?? []
  const effectiveCarrier = carrierChoice === 'Otro' ? carrierOtherText.trim() : carrierChoice

  // Nota: la direccion/localidad/provincia se piden SIEMPRE, sin excepcion
  // por metodo de envio (incluido "retiro en local"), porque muchos mayoristas
  // despachan por expreso fuera del sistema y necesitan estos datos igual
  // para imprimir la etiqueta e imputar el envio.

  const totalConEnvio = total + shippingCost
  const minOrder: number | null = storeConfig?.min_order_amount ?? null
  const { meetsMin, meetsProductMinimums, unmetProducts } = useCartValidation(minOrder)

  async function handleContinuar() {
    if (!meetsMin) {
      const falta = formatPrice(minOrder! - total)
      setError(`El pedido mínimo es de ${formatPrice(minOrder!)}. Te faltan ${falta}.`)
      return
    }
    if (!meetsProductMinimums) {
      const detalle = unmetProducts.map(u => `${u.productName} (faltan ${u.need})`).join(', ')
      setError(`Algunos productos no llegan al mínimo por artículo: ${detalle}.`)
      return
    }
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return }
    if (!apellido.trim()) { setError('El apellido es obligatorio'); return }
    if (!email.trim()) { setError('El email es obligatorio'); return }
    if (!phone.trim()) { setError('El teléfono es obligatorio'); return }
    if (!cuil.trim()) { setError('El CUIL/CUIT es obligatorio'); return }
    if (!addressStreet.trim()) { setError('La dirección es obligatoria'); return }
    if (!addressCity.trim()) { setError('La localidad es obligatoria'); return }
    if (!addressProvince.trim()) { setError('La provincia es obligatoria'); return }
    if (!addressZip.trim()) { setError('El código postal es obligatorio'); return }
    if (!country.trim()) { setError('El país es obligatorio'); return }
    if (selectedMethodCarriers.length > 0 && !effectiveCarrier) {
      setError('Elegí un transporte (o "Otro" y escribí cuál)')
      return
    }
    setError(null)
    setStep('pago')
  }

  async function createOrder(paymentMethod: 'mercadopago' | 'transfer') {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout/crear-pedido', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: nombre.trim(),
          lastName: apellido.trim(),
          fullName: `${nombre.trim()} ${apellido.trim()}`.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          cuil: cuil.trim() || null,
          addressStreet: addressStreet.trim() || null,
          addressCity: addressCity.trim() || null,
          addressProvince: addressProvince.trim() || null,
          addressZip: addressZip.trim() || null,
          country: country.trim() || null,
          shippingMethod,
          shippingCost,
          shippingCarrier: effectiveCarrier || null,
          notes: notes.trim() || null,
          paymentMethod,
          items: items.map(item => ({
            variantId: item.variantId,
            productName: item.productName,
            variantDesc: item.variantDesc,
            quantity: item.quantity,
            price: item.price,
            priceType: item.priceType,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al crear el pedido')
      return data.order
    } catch (err: any) {
      setError(err.message ?? 'Error al crear el pedido')
      setLoading(false)
      return null
    }
  }

  async function handleMercadoPago() {
    const order = await createOrder('mercadopago')
    if (!order) return
    try {
      const res = await fetch('/api/mp/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: TENANT_ID(), order_id: order.id,
          items: items.map(item => ({
            variant_id: item.variantId, name: item.productName,
            variant_desc: item.variantDesc, quantity: item.quantity, unit_price: item.price,
          })),
          payer: { name: `${nombre} ${apellido}`, email, phone },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      clearCart()
      window.location.href = data.init_point ?? data.sandbox_init_point
    } catch (err: any) {
      setError(err.message ?? 'Error al iniciar el pago')
      setLoading(false)
    }
  }

  async function handleTransferencia() {
    const order = await createOrder('transfer')
    if (!order) return
    setCurrentOrderId(order.id)
    setOrderTotal(totalConEnvio)
    clearCart()
    setStep('qr')
    setLoading(false)
  }

  function copyToClipboard(text: string, type: 'alias' | 'cbu') {
    navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  const inputClass = "w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
  const inputDisabledClass = "w-full px-3 py-2.5 border border-[var(--color-border)] bg-[#F2EEE9] text-sm text-[var(--color-stone)] cursor-not-allowed"
  const labelClass = "block text-xs text-[var(--color-stone)] mb-1.5"

  const navbarProps = {
    storeName: branding.storeName,
    logoUrl: branding.logoUrl,
    instagramUrl: branding.instagramUrl,
    facebookUrl: branding.facebookUrl,
    tiktokUrl: branding.tiktokUrl,
  }
  const footerProps = {
    storeName: branding.storeName,
    logoUrl: branding.logoUrl,
    whatsapp: branding.whatsapp,
    email: branding.email,
    instagramUrl: branding.instagramUrl,
    facebookUrl: branding.facebookUrl,
    tiktokUrl: branding.tiktokUrl,
    branches: branding.branches,
  }

  if (items.length === 0 && step !== 'qr') {
    return (
      <>
        <Navbar {...navbarProps} />
        <main className="pt-28 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="font-display text-3xl font-light text-[var(--color-stone)] mb-6">Tu carrito está vacío</p>
            <Link href={shopHref} className="inline-flex items-center gap-2 text-xs tracking-[0.2em] uppercase border-b border-[var(--color-charcoal)] pb-1 text-[var(--color-charcoal)]">
              Ir a la tienda
            </Link>
          </div>
        </main>
        <Footer {...footerProps} />
      </>
    )
  }

  // ── PANTALLA TRANSFERENCIA ────────────────────────────────
  if (step === 'qr') {
    return (
      <>
        <Navbar {...navbarProps} />
        <main className="pt-28 min-h-screen flex items-center justify-center">
          <div className="max-w-sm w-full mx-auto px-6 text-center">
            <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)] mb-2">
              Transferencia bancaria
            </p>
            <h1 className="font-display text-4xl font-light text-[var(--color-charcoal)] mb-1">
              {formatPrice(orderTotal)}
            </h1>
            {currentOrderId && (
              <p className="text-xs text-[var(--color-stone)] font-mono mb-8">
                Pedido #{currentOrderId.slice(0, 8).toUpperCase()}
              </p>
            )}

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-stone)]">o transferí manualmente</span>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
            </div>

            <div className="space-y-3 mb-8">
              {storeConfig?.transfer_alias && (
                <div className="flex items-center justify-between bg-[#F2EEE9] px-4 py-3 text-left">
                  <div>
                    <p className="text-xs text-[var(--color-stone)] mb-0.5">Alias</p>
                    <p className="text-sm font-light text-[var(--color-charcoal)]">{storeConfig.transfer_alias}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(storeConfig.transfer_alias, 'alias')}
                    className="text-xs text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors flex items-center gap-1 flex-shrink-0 ml-4"
                  >
                    {copied === 'alias' ? <><Check size={12} /> Copiado</> : 'Copiar'}
                  </button>
                </div>
              )}
              {storeConfig?.transfer_cbu && (
                <div className="flex items-center justify-between bg-[#F2EEE9] px-4 py-3 text-left">
                  <div className="min-w-0">
                    <p className="text-xs text-[var(--color-stone)] mb-0.5">CBU</p>
                    <p className="text-xs font-mono font-light text-[var(--color-charcoal)] break-all">{storeConfig.transfer_cbu}</p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(storeConfig.transfer_cbu, 'cbu')}
                    className="text-xs text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors flex items-center gap-1 flex-shrink-0 ml-4"
                  >
                    {copied === 'cbu' ? <><Check size={12} /> Copiado</> : 'Copiar'}
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-[var(--color-stone)] mb-6 leading-relaxed">
              Una vez realizada la transferencia, envianos el comprobante por WhatsApp y confirmamos tu pedido.
            </p>

            <div className="space-y-3">
              {storeConfig?.whatsapp_number && (
                <a
                  href={`https://wa.me/${storeConfig.whatsapp_number.replace(/\D/g, '')}?text=Hola! Realicé el pedido %23${currentOrderId?.slice(0, 8).toUpperCase() ?? ''} por ${formatPrice(orderTotal)} y quiero enviar el comprobante.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full py-3.5 bg-[var(--color-charcoal)] text-white text-xs tracking-[0.2em] uppercase text-center hover:bg-[var(--color-stone)] transition-colors"
                >
                  Enviar comprobante por WhatsApp
                </a>
              )}
              <Link
                href={shopHref}
                className="block w-full py-3 border border-[var(--color-border)] text-xs tracking-[0.2em] uppercase text-center text-[var(--color-stone)] hover:border-[var(--color-charcoal)] hover:text-[var(--color-charcoal)] transition-colors"
              >
                Seguir comprando
              </Link>
            </div>
          </div>
        </main>
        <Footer {...footerProps} />
      </>
    )
  }

  // ── CHECKOUT NORMAL ──────────────────────────────────────
  return (
    <>
      <Navbar {...navbarProps} />
      <main className="pt-28 min-h-screen">
        <div className="max-w-5xl mx-auto px-6 py-12">

          <div className="flex items-center gap-4 mb-10">
            <Link href={carritoHref} className="text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors">
              <ArrowLeft size={20} strokeWidth={1.5} />
            </Link>
            <h1 className="font-display text-4xl font-light text-[var(--color-charcoal)]">
              {step === 'datos' ? 'Tus datos' : 'Método de pago'}
            </h1>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">

              {step === 'datos' && (
                <div className="space-y-6">

                  {/* Datos personales */}
                  <div className="space-y-4">
                    <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)]">Datos personales</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Nombre *</label>
                        <input className={inputClass} value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" />
                      </div>
                      <div>
                        <label className={labelClass}>Apellido *</label>
                        <input className={inputClass} value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Tu apellido" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>CUIL / CUIT *</label>
                        <input className={inputClass} value={cuil} onChange={e => setCuil(e.target.value)} placeholder="20-12345678-9" />
                      </div>
                      <div>
                        <label className={labelClass}>Teléfono *</label>
                        <input className={inputClass} value={phone} onChange={e => setPhone(e.target.value)} placeholder="+54 9 11 XXXX-XXXX" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>
                        Email *{emailLocked && <span className="ml-2 text-[10px] text-[var(--color-stone)] normal-case tracking-normal">(asociado a tu cuenta)</span>}
                      </label>
                      <input
                        className={emailLocked ? inputDisabledClass : inputClass}
                        type="email"
                        value={email}
                        onChange={e => !emailLocked && setEmail(e.target.value)}
                        readOnly={emailLocked}
                        placeholder="tu@email.com"
                      />
                    </div>
                  </div>

                  {/* Método de envío (solo si el tenant configuró opciones propias) */}
                  {activeCustomMethods.length > 0 && (
                    <div className="space-y-4 pt-2">
                      <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)]">Método de envío</p>
                      <div className="space-y-2">
                        {activeCustomMethods.map((m: any, i: number) => {
                          const val = `custom_${i}`
                          const carriers: string[] = m.carriers ?? []
                          const isSelected = shippingMethod === val
                          return (
                            <div key={i}>
                              <label className={`flex items-center gap-3 p-4 border cursor-pointer transition-colors ${isSelected ? 'border-[var(--color-charcoal)]' : 'border-[var(--color-border)] hover:border-[var(--color-stone)]'}`}>
                                <input
                                  type="radio"
                                  name="shipping"
                                  value={val}
                                  checked={isSelected}
                                  onChange={() => {
                                    setShippingMethod(val)
                                    setShippingCost(m.priceOnRequest ? 0 : (m.price ?? 0))
                                    setCarrierChoice('')
                                    setCarrierOtherText('')
                                  }}
                                  className="accent-[var(--color-charcoal)]"
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-light text-[var(--color-charcoal)]">{m.name}</p>
                                </div>
                                <span className="text-sm font-light text-[var(--color-charcoal)]">
                                  {m.priceOnRequest ? 'A convenir' : ((m.price ?? 0) > 0 ? formatPrice(m.price) : 'Gratis')}
                                </span>
                              </label>
                              {isSelected && carriers.length > 0 && (
                                <div className="pl-4 pr-4 pb-4 -mt-1 border border-t-0 border-[var(--color-charcoal)] space-y-2">
                                  <label className={labelClass}>Transporte *</label>
                                  <select
                                    className={inputClass}
                                    value={carrierChoice}
                                    onChange={e => setCarrierChoice(e.target.value)}
                                  >
                                    <option value="">Seleccioná un transporte</option>
                                    {carriers.map(c => <option key={c} value={c}>{c}</option>)}
                                    <option value="Otro">Otro</option>
                                  </select>
                                  {carrierChoice === 'Otro' && (
                                    <input
                                      className={inputClass}
                                      value={carrierOtherText}
                                      onChange={e => setCarrierOtherText(e.target.value)}
                                      placeholder="Nombre del transporte"
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Dirección de envío — SIEMPRE visible y obligatoria, sin excepcion
                      por metodo de envio elegido (incluido "retiro en local").
                      No depende de si el tenant configuró métodos de envío propios:
                      muchos mayoristas despachan con expreso y no cargan nada acá,
                      pero igual necesitan estos datos para imprimir la etiqueta. */}
                  <div className="space-y-4 pt-2">
                    <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)]">Dirección de envío</p>
                    <div>
                      <label className={labelClass}>Calle y número *</label>
                      <input className={inputClass} value={addressStreet} onChange={e => setAddressStreet(e.target.value)} placeholder="Av. Corrientes 1234" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Provincia *</label>
                        <select className={inputClass} value={addressProvince} onChange={e => setAddressProvince(e.target.value)}>
                          <option value="">Seleccioná una provincia</option>
                          {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelClass}>Localidad *</label>
                        <LocalidadAutocomplete value={addressCity} provincia={addressProvince} onChange={setAddressCity} inputClass={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Código postal *</label>
                        <input className={inputClass} value={addressZip} onChange={e => setAddressZip(e.target.value)} placeholder="1000" />
                      </div>
                      <div>
                        <label className={labelClass}>País *</label>
                        <input className={inputClass} value={country} onChange={e => setCountry(e.target.value)} placeholder="Argentina" />
                      </div>
                    </div>
                  </div>

                  {/* Notas */}
                  <div>
                    <label className={labelClass}>Notas (opcional)</label>
                    <textarea className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instrucciones especiales..." />
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <button
                    onClick={handleContinuar}
                    disabled={!meetsMin || !meetsProductMinimums}
                    className="w-full py-4 bg-[var(--color-charcoal)] text-white text-xs tracking-[0.2em] uppercase hover:bg-[var(--color-stone)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continuar →
                  </button>
                </div>
              )}

              {step === 'pago' && (
                <div className="space-y-4">
                  <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)]">Elegí cómo pagar</p>
                  {storeConfig?.mp_enabled && (
                    <button onClick={handleMercadoPago} disabled={loading} className="w-full flex items-center gap-4 p-5 border border-[var(--color-border)] hover:border-[var(--color-charcoal)] transition-colors text-left disabled:opacity-60">
                      <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <CreditCard size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-light text-[var(--color-charcoal)]">MercadoPago</p>
                        <p className="text-xs text-[var(--color-stone)] mt-0.5">Tarjeta, débito, QR, cuotas</p>
                      </div>
                      <span className="text-[var(--color-stone)]">→</span>
                    </button>
                  )}
                  {storeConfig?.transfer_enabled && (
                    <button onClick={() => setShowTransferConfirm(true)} disabled={loading} className="w-full flex items-center gap-4 p-5 border border-[var(--color-border)] hover:border-[var(--color-charcoal)] transition-colors text-left disabled:opacity-60">
                      <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 size={20} className="text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-light text-[var(--color-charcoal)]">Transferencia bancaria</p>
                        <p className="text-xs text-[var(--color-stone)] mt-0.5">CBU / Alias · Sin comisión</p>
                      </div>
                      <span className="text-[var(--color-stone)]">→</span>
                    </button>
                  )}
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button onClick={() => setStep('datos')} className="text-xs text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors">
                    ← Volver a mis datos
                  </button>
                </div>
              )}
            </div>

            {/* Resumen del pedido */}
            <div className="lg:col-span-1">
              <div className="bg-[#F2EEE9] p-6 sticky top-28">
                <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)] mb-5">Tu pedido</p>
                <div className="space-y-4 mb-5">
                  {items.map(item => (
                    <div key={item.variantId} className="flex gap-3">
                      <div className="w-14 h-14 bg-white flex-shrink-0 overflow-hidden">
                        {item.imageUrl
                          ? <img src={item.imageUrl} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><ImageOff size={16} className="text-[var(--color-border)]" /></div>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-light text-[var(--color-charcoal)] truncate">{item.productName}</p>
                        {item.variantDesc && <p className="text-xs text-[var(--color-stone)]">{item.variantDesc}</p>}
                        <p className="text-xs text-[var(--color-stone)] mt-0.5">×{item.quantity}</p>
                      </div>
                      <p className="text-xs font-light text-[var(--color-charcoal)] flex-shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[var(--color-border)] pt-4 space-y-2">
                  <div className="flex justify-between items-center text-xs text-[var(--color-stone)]">
                    <span>Subtotal</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  {selectedMethod && (
                    <div className="flex justify-between items-center text-xs text-[var(--color-stone)]">
                      <span>Envío ({selectedMethod.name})</span>
                      <span>{selectedMethod.priceOnRequest ? 'A convenir' : (shippingCost > 0 ? formatPrice(shippingCost) : 'Gratis')}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-[var(--color-border)]">
                    <span className="text-xs tracking-[0.15em] uppercase text-[var(--color-charcoal)]">Total</span>
                    <span className="font-display text-2xl font-light text-[var(--color-charcoal)]">
                      {formatPrice(totalConEnvio)}
                    </span>
                  </div>
                  {selectedMethod?.priceOnRequest && (
                    <p className="text-[11px] text-[var(--color-stone)] italic">
                      El costo de envío no está incluido — te lo coordinamos aparte.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {showTransferConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white max-w-sm w-full p-6">
            <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)] mb-2">Confirmar método de pago</p>
            <h2 className="font-display text-2xl font-light text-[var(--color-charcoal)] mb-3">Transferencia bancaria</h2>
            <p className="text-sm text-[var(--color-stone)] font-light leading-relaxed mb-6">
              Vas a pagar por <strong>transferencia bancaria</strong>: tenés que transferir el monto manualmente y enviarnos el comprobante por WhatsApp. Si en realidad querías pagar con tarjeta o MercadoPago, volvé atrás y elegí esa opción.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTransferConfirm(false)}
                className="flex-1 py-3 border border-[var(--color-border)] text-xs tracking-[0.15em] uppercase text-[var(--color-stone)] hover:border-[var(--color-charcoal)] hover:text-[var(--color-charcoal)] transition-colors"
              >
                Volver
              </button>
              <button
                onClick={() => { setShowTransferConfirm(false); handleTransferencia() }}
                disabled={loading}
                className="flex-1 py-3 bg-[var(--color-charcoal)] text-white text-xs tracking-[0.15em] uppercase hover:bg-[var(--color-stone)] transition-colors disabled:opacity-60"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer {...footerProps} />
    </>
  )
}
