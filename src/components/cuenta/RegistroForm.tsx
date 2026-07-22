'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Turnstile from 'react-turnstile'
import { createClient, TENANT_ID } from '../../lib/supabase'

type Tipo = 'retail' | 'wholesale'

const PROVINCIAS = [
  'Buenos Aires', 'Ciudad Autónoma de Buenos Aires', 'Catamarca', 'Chaco', 'Chubut',
  'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis',
  'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
]

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    )
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

type Props = {
  isUpgrade: boolean
  initialNombre?: string
  initialApellido?: string
  initialEmail?: string
}

// Formulario de alta / upgrade a mayorista, compartido por todos los templates
// vía @creart/tienda-core/RegistroForm. Los datos iniciales (nombre, apellido,
// email) para el flujo de upgrade se resuelven en el servidor — ver
// RegistroPage.tsx — en vez de volver a pedirlos acá por dos motivos:
// 1) evita depender de una segunda consulta client-side que podía fallar en
//    silencio (customer importado sin auth_user_id vinculado, timing de la
//    sesión del browser, etc.) dejando nombre/apellido vacíos sin avisar.
// 2) RegistroPage ya valida que haya sesión ANTES de renderizar este
//    formulario, así que el cartel "Iniciá sesión..." del API ya casi nunca
//    debería aparecer (solo si la sesión vence mientras se completa el form).
export default function RegistroForm({ isUpgrade, initialNombre = '', initialApellido = '', initialEmail = '' }: Props) {
  const [tipo, setTipo] = useState<Tipo>(isUpgrade ? 'wholesale' : 'retail')
  const [form, setForm] = useState({
    nombre: initialNombre, apellido: initialApellido, email: initialEmail, password: '', confirmar: '',
    empresa: '', cuit: '', direccion: '', provincia: '', localidad: '',
  })
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [exito, setExito] = useState(false)
  const [confirmacion, setConfirmacion] = useState(false)
  const [regVisibility, setRegVisibility] = useState<'both' | 'retail_only' | 'wholesale_only'>('both')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('store_config')
      .select('registration_visibility')
      .eq('tenant_id', TENANT_ID())
      .single()
      .then(({ data }) => {
        const rv = ((data as any)?.registration_visibility ?? 'both') as typeof regVisibility
        setRegVisibility(rv)
        if (rv === 'retail_only' && !isUpgrade) setTipo('retail')
        if (rv === 'wholesale_only' && !isUpgrade) setTipo('wholesale')
      })
  }, [isUpgrade])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!isUpgrade && form.password !== form.confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (tipo === 'wholesale') {
      if (!form.empresa || !form.cuit) { setError('Empresa y CUIT son obligatorios'); return }
      if (!form.provincia || !form.localidad) { setError('Provincia y localidad son obligatorias'); return }
      if (!form.direccion) { setError('La dirección es obligatoria'); return }
    }
    if (!turnstileToken) {
      setError('Completá la verificación de seguridad')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email,
          password: isUpgrade ? undefined : form.password,
          tipo,
          empresa: form.empresa || undefined,
          cuit: form.cuit || undefined,
          direccion: form.direccion || undefined,
          provincia: form.provincia || undefined,
          localidad: form.localidad || undefined,
          turnstileToken,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error)
        setTurnstileToken(null)
        setTurnstileKey(k => k + 1)  // fuerza re-mount del widget con token nuevo
        return
      }
      setConfirmacion(data.confirmacion ?? false)
      setExito(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (exito) {
    // Alta nueva que todavía necesita que confirmen el mail: es el caso que
    // más se presta a confusión (la cuenta "existe" pero no sirve para nada
    // hasta que hacen click en el link del correo, y ese paso se olvida
    // fácil). Por eso tiene su propio ícono/copy en vez de reusar el de
    // "listo" — que sí aplica cuando no hace falta confirmación (o para el
    // upgrade a mayorista, que no manda mail de confirmación).
    const pendienteDeConfirmar = !isUpgrade && confirmacion

    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-[var(--color-charcoal)] rounded-full flex items-center justify-center mx-auto mb-6">
            {pendienteDeConfirmar ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 6 10-6" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <h1 className="font-display text-3xl font-light text-[var(--color-charcoal)] mb-3">
            {isUpgrade ? '¡Cuenta actualizada!' : pendienteDeConfirmar ? 'Falta un paso' : '¡Registro exitoso!'}
          </h1>
          <p className="text-sm text-[var(--color-stone)] font-light leading-relaxed mb-6">
            {isUpgrade
              ? <>Tu cuenta ahora es mayorista. Ya podés ver los precios y condiciones de mayorista.</>
              : pendienteDeConfirmar
                ? <>Te enviamos un email a <strong>{form.email}</strong> para confirmar tu cuenta. <strong>Tu registro recién queda activo cuando hacés click en el link de ese correo</strong> — hasta entonces no vas a poder iniciar sesión. Si no lo ves en unos minutos, revisá spam / correo no deseado.</>
                : <>Tu cuenta fue creada. Recibiste un email de bienvenida en <strong>{form.email}</strong>. Ya podés iniciar sesión.</>
            }
          </p>
          {isUpgrade ? (
            <a href="/cuenta" className="text-sm text-[var(--color-charcoal)] underline hover:text-[var(--color-stone)] transition-colors">
              Ir a mi cuenta
            </a>
          ) : (
            <Link href="/cuenta/login" className="text-sm text-[var(--color-charcoal)] underline hover:text-[var(--color-stone)] transition-colors">
              Ir al inicio de sesión
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">

        {/* Logo / volver */}
        <div className="text-center mb-10">
          <Link href="/tienda" className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors">
            ← Volver a la tienda
          </Link>
          <h1 className="font-display text-4xl font-light text-[var(--color-charcoal)] mt-4">
            {isUpgrade ? 'Pasate a Mayorista' : 'Crear cuenta'}
          </h1>
        </div>

        {/* Selector de tipo — oculto si la tienda solo permite un tipo de cuenta, o si es un upgrade */}
        {regVisibility === 'both' && !isUpgrade && (
          <div className="flex mb-8 border border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setTipo('retail')}
              className={`flex-1 py-3 text-sm tracking-[0.1em] uppercase transition-colors ${tipo === 'retail' ? 'bg-[var(--color-charcoal)] text-white' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}
            >
              Minorista
            </button>
            <button
              type="button"
              onClick={() => setTipo('wholesale')}
              className={`flex-1 py-3 text-sm tracking-[0.1em] uppercase transition-colors ${tipo === 'wholesale' ? 'bg-[var(--color-charcoal)] text-white' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}
            >
              Mayorista
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Nombre y Apellido */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Nombre *</label>
              <input
                className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                value={form.nombre} onChange={e => set('nombre', e.target.value)} required
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Apellido</label>
              <input
                className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                value={form.apellido} onChange={e => set('apellido', e.target.value)}
              />
            </div>
          </div>

          {/* Campos mayorista */}
          {tipo === 'wholesale' && (
            <>
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Nombre de la Empresa *</label>
                <input
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                  value={form.empresa} onChange={e => set('empresa', e.target.value)} required
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">CUIT *</label>
                <input
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                  value={form.cuit} onChange={e => set('cuit', e.target.value)} required
                  placeholder="20-12345678-9"
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Dirección *</label>
                <input
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                  placeholder="Ej: Av. Corrientes 1234"
                  value={form.direccion} onChange={e => set('direccion', e.target.value)} required
                />
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Provincia *</label>
                <div className="relative">
                  <select
                    className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors appearance-none"
                    value={form.provincia} onChange={e => set('provincia', e.target.value)} required
                  >
                    <option value="">Seleccioná una provincia</option>
                    {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Localidad *</label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                  placeholder="Ej: Mar del Plata"
                  value={form.localidad}
                  onChange={e => set('localidad', e.target.value)}
                  required
                />
              </div>
            </>
          )}

          {/* Email */}
          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Email *</label>
            <input
              type="email"
              className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors disabled:bg-zinc-100 disabled:text-[var(--color-stone)]"
              value={form.email} onChange={e => set('email', e.target.value)} required
              readOnly={isUpgrade} disabled={isUpgrade}
            />
          </div>

          {/* El upgrade a mayorista usa la sesión ya iniciada para confirmar
              identidad — no hace falta (ni tiene sentido) pedir contraseña acá.
              Pedirla sin aclarar que debía ser la ACTUAL era justo lo que
              rompía el upgrade: la mayoría escribía una nueva y el tipo de
              cuenta nunca se actualizaba a mayorista. */}
          {!isUpgrade && (
            <>
              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Contraseña *</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="w-full px-3 py-2.5 pr-10 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                    value={form.password} onChange={e => set('password', e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors">
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Confirmar Contraseña *</label>
                <div className="relative">
                  <input
                    type={showConfirmar ? 'text' : 'password'}
                    className="w-full px-3 py-2.5 pr-10 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                    value={form.confirmar} onChange={e => set('confirmar', e.target.value)} required minLength={8}
                  />
                  <button type="button" onClick={() => setShowConfirmar(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors">
                    <EyeIcon open={showConfirmar} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Turnstile */}
          <div className="flex justify-center py-2">
            <Turnstile
              key={turnstileKey}
              sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '1x00000000000000000000AA'}
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
            {loading ? 'Guardando...' : isUpgrade ? 'Actualizar a mayorista' : 'Crear cuenta'}
          </button>

          {!isUpgrade && (
            <p className="text-center text-sm text-[var(--color-stone)] font-light">
              ¿Ya tenés cuenta?{' '}
              <Link href="/cuenta/login" className="text-[var(--color-charcoal)] underline hover:text-[var(--color-stone)] transition-colors">
                Iniciar sesión
              </Link>
            </p>
          )}

        </form>
      </div>
    </div>
  )
}
