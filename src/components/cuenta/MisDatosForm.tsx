'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PROVINCIAS } from './RegistroForm'

type Props = {
  isWholesale: boolean
  initial: {
    nombre: string
    apellido: string
    dni: string
    telefono: string
    email: string
    empresa: string
    cuit: string
    direccion: string
    provincia: string
    localidad: string
  }
}

// Formulario de "Mis datos", compartido por todos los templates vía
// @creart/tienda-core/MisDatosPage. Complementa el registro simplificado
// (2026-07-31): el alta solo pide lo mínimo (empresa + DNI para mayoristas),
// acá el cliente completa el resto cuando quiere — CUIT, dirección, teléfono,
// email de contacto — sin fricción en el paso de registro.
export default function MisDatosForm({ isWholesale, initial }: Props) {
  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setGuardado(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.nombre) { setError('El nombre es obligatorio'); return }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/actualizar-datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'No se pudieron guardar los datos'); return }
      setGuardado(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">

        <div className="text-center mb-10">
          <Link href="/cuenta" className="text-xs tracking-[0.2em] uppercase text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors">
            ← Volver a mi cuenta
          </Link>
          <h1 className="font-display text-4xl font-light text-[var(--color-charcoal)] mt-4">Mis datos</h1>
          <p className="text-sm text-[var(--color-stone)] font-light mt-2">
            Actualizá tus datos de contacto{isWholesale ? ' y fiscales' : ''} cuando quieras.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">DNI</label>
              <input
                className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                value={form.dni} onChange={e => set('dni', e.target.value)} placeholder="Sin puntos"
              />
            </div>
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Teléfono</label>
              <input
                className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="Ej: 11 5555-5555"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Email de contacto</label>
            <input
              type="email"
              className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
              value={form.email} onChange={e => set('email', e.target.value)}
            />
            <p className="text-[11px] text-[var(--color-stone)] font-light mt-1">
              Es el mail donde recibís novedades de tus pedidos — no cambia con qué mail iniciás sesión.
            </p>
          </div>

          {/* Datos fiscales — visibles siempre, más relevantes para mayoristas
              pero cualquier cliente puede completarlos (ej: para pedir factura). */}
          <div className="pt-2 border-t border-[var(--color-border)]">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[var(--color-stone)] mt-4 mb-3">
              Datos {isWholesale ? 'de la empresa' : 'fiscales (opcional)'}
            </p>
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Nombre de la empresa</label>
            <input
              className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
              value={form.empresa} onChange={e => set('empresa', e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">CUIT</label>
            <input
              className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
              value={form.cuit} onChange={e => set('cuit', e.target.value)} placeholder="20-12345678-9"
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Dirección</label>
            <input
              className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
              placeholder="Ej: Av. Corrientes 1234"
              value={form.direccion} onChange={e => set('direccion', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Provincia</label>
              <div className="relative">
                <select
                  className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors appearance-none"
                  value={form.provincia} onChange={e => set('provincia', e.target.value)}
                >
                  <option value="">Sin especificar</option>
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
              <label className="block text-[10px] tracking-[0.15em] uppercase text-[var(--color-stone)] mb-1.5">Localidad</label>
              <input
                className="w-full px-3 py-2.5 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
                placeholder="Ej: Mar del Plata"
                value={form.localidad} onChange={e => set('localidad', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3">{error}</p>
          )}
          {guardado && !error && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 px-4 py-3">
              Tus datos se guardaron correctamente.
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[var(--color-charcoal)] text-white text-[11px] tracking-[0.2em] uppercase hover:bg-[var(--color-stone)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Guardando...' : 'Guardar datos'}
          </button>
        </form>
      </div>
    </div>
  )
}
