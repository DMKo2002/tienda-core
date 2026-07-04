'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'

interface Subcategory {
  id: string
  name: string
  slug: string
  productCount?: number
  subcategories?: Subcategory[]
}

interface Category {
  id: string
  name: string
  slug: string
  productCount?: number
  subcategories: Subcategory[]
}

interface CatalogFiltersProps {
  categories: Category[]
  availableColors: string[]
  availableSizes: string[]
  maxPrice: number
  currentCat?: string
  currentOrden?: string
  currentQ?: string
  currentColor?: string
  currentTalle?: string
  currentPrecioMin?: number
  currentPrecioMax?: number
  currentDescuento?: boolean
}

const COLOR_MAP: Record<string, string> = {
  negro: '#1C1C1C', blanco: '#F5F5F0', crema: '#F0EBE1', beige: '#D4C5A9',
  marfil: '#FFFFF0', gris: '#9E9E9E', 'gris claro': '#D0D0D0', 'gris oscuro': '#555555',
  rojo: '#C0392B', bordo: '#7B2D42', vino: '#6B2737', rosa: '#E8A0B0',
  coral: '#E8714A', naranja: '#E8813A', mostaza: '#C8A84B', amarillo: '#F0CC4A',
  azul: '#3A7BC8', 'azul marino': '#1B3A6B', 'azul claro': '#7EB8E0', celeste: '#87CEEB',
  verde: '#4A9B6F', 'verde oscuro': '#2D6A4F', esmeralda: '#2E8B6E', turquesa: '#3AADA8',
  lila: '#B09BC8', violeta: '#8E44AD', morado: '#6C3483',
  camel: '#C19A6B', tabaco: '#8B6355', chocolate: '#5C3A1E', tiza: '#E8E4DC', off: '#F5F2EC',
}

function getColorHex(name: string): string {
  if (/^#[0-9A-Fa-f]{3,6}$/.test(name.trim())) return name.trim()
  return COLOR_MAP[name.toLowerCase().trim()] ?? '#CCCCCC'
}
function isLight(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 180
}

function SectionHeader({ label, open, onToggle, active }: { label: string; open: boolean; onToggle: () => void; active?: boolean }) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between group"
    >
      <p className={`text-[10px] tracking-[0.2em] uppercase transition-colors ${active ? 'text-[var(--color-charcoal)]' : 'text-[var(--color-stone)] group-hover:text-[var(--color-charcoal)]'}`}>
        {label}{active ? ' ·' : ''}
      </p>
      <ChevronDown
        size={12}
        className={`text-[var(--color-stone)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      />
    </button>
  )
}

export default function CatalogFilters({
  categories, availableColors, availableSizes, maxPrice,
  currentCat, currentOrden, currentQ, currentColor, currentTalle,
  currentPrecioMin, currentPrecioMax, currentDescuento,
}: CatalogFiltersProps) {
  const router = useRouter()
  const [q, setQ] = useState(currentQ ?? '')
  const [precioMin, setPrecioMin] = useState(String(currentPrecioMin ?? ''))
  const [precioMax, setPrecioMax] = useState(String(currentPrecioMax ?? ''))

  // Cada sección tiene su propio estado de abierto/cerrado
  // Secciones con filtro activo arrancan abiertas; resto según default
  const [open, setOpen] = useState({
    categorias: !!currentCat,
    colores: !!currentColor,
    talles: !!currentTalle,
    precio: !!(currentPrecioMin || currentPrecioMax),
    ordenar: !!currentOrden,
  })

  function toggle(key: keyof typeof open) {
    setOpen(s => ({ ...s, [key]: !s[key] }))
  }

  const buildUrl = useCallback((overrides: Record<string, string | undefined>) => {
    const params: Record<string, string> = {}
    if (currentCat) params.cat = currentCat
    if (currentOrden) params.orden = currentOrden
    if (q) params.q = q
    if (currentColor) params.color = currentColor
    if (currentTalle) params.talle = currentTalle
    if (precioMin) params.precio_min = precioMin
    if (precioMax) params.precio_max = precioMax
    if (currentDescuento) params.descuento = '1'
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === '') delete params[k]
      else params[k] = v
    })
    const qs = new URLSearchParams(params).toString()
    return `/tienda${qs ? '?' + qs : ''}`
  }, [currentCat, currentOrden, q, currentColor, currentTalle, precioMin, precioMax, currentDescuento])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ q: q || undefined }))
  }

  function handlePrecio(e: React.FormEvent) {
    e.preventDefault()
    router.push(buildUrl({ precio_min: precioMin || undefined, precio_max: precioMax || undefined }))
  }

  const activeFilters = [
    currentCat && { label: currentCat, clear: buildUrl({ cat: undefined }) },
    currentColor && { label: currentColor, clear: buildUrl({ color: undefined }) },
    currentTalle && { label: `Talle ${currentTalle}`, clear: buildUrl({ talle: undefined }) },
    currentPrecioMin && { label: `desde $${currentPrecioMin.toLocaleString('es-AR')}`, clear: buildUrl({ precio_min: undefined }) },
    currentPrecioMax && { label: `hasta $${currentPrecioMax.toLocaleString('es-AR')}`, clear: buildUrl({ precio_max: undefined }) },
    currentDescuento && { label: 'En descuento', clear: buildUrl({ descuento: undefined }) },
    currentQ && { label: `"${currentQ}"`, clear: buildUrl({ q: undefined }) },
  ].filter(Boolean) as { label: string; clear: string }[]

  return (
    <div className="space-y-1 sticky top-28">

      {/* Buscador */}
      <div className="pb-5">
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar productos..."
            className="w-full px-3 py-2 pr-8 border border-[var(--color-border)] bg-white text-sm focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
          />
          {q ? (
            <button type="button" onClick={() => { setQ(''); router.push(buildUrl({ q: undefined })) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
              <X size={14} />
            </button>
          ) : (
            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)]">
              <Search size={14} />
            </button>
          )}
        </form>
      </div>

      {/* Filtros activos */}
      {activeFilters.length > 0 && (
        <div className="pb-4">
          <div className="flex flex-wrap gap-1.5">
            {activeFilters.map(f => (
              <button
                key={f.label}
                onClick={() => router.push(f.clear)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] tracking-wide border border-[var(--color-charcoal)] text-[var(--color-charcoal)] hover:bg-[var(--color-charcoal)] hover:text-white transition-colors"
              >
                {f.label} <X size={9} />
              </button>
            ))}
            <button
              onClick={() => router.push('/tienda')}
              className="text-[10px] text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors underline"
            >
              Limpiar todo
            </button>
          </div>
        </div>
      )}

      {/* ── Categorías ── */}
      <div className="border-t border-[var(--color-border)] py-4">
        <SectionHeader label="Categorías" open={open.categorias} onToggle={() => toggle('categorias')} active={!!currentCat} />
        {open.categorias && (
          <ul className="mt-3 space-y-2">
            <li>
              <button onClick={() => router.push(buildUrl({ cat: undefined }))}
                className={`text-sm font-light transition-colors ${!currentCat ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}>
                Todos
              </button>
            </li>
            {categories.map(cat => (
              <li key={cat.id}>
                <button onClick={() => router.push(buildUrl({ cat: cat.slug }))}
                  className={`text-sm font-light transition-colors ${currentCat === cat.slug ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}>
                  {cat.name}{cat.productCount !== undefined && cat.productCount > 0 && <span className="ml-1.5 text-[10px] text-[var(--color-stone)]/60">({cat.productCount})</span>}
                </button>
                {cat.subcategories.length > 0 && (
                  <ul className="mt-1.5 ml-3 space-y-1.5 border-l border-[var(--color-border)] pl-3">
                    {cat.subcategories.map(sub => (
                      <li key={sub.id}>
                        <button onClick={() => router.push(buildUrl({ cat: sub.slug }))}
                          className={`text-xs font-light transition-colors ${currentCat === sub.slug ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}>
                          {sub.name}{sub.productCount !== undefined && sub.productCount > 0 && <span className="ml-1 text-[10px] text-[var(--color-stone)]/60">({sub.productCount})</span>}
                        </button>
                        {sub.subcategories && sub.subcategories.length > 0 && (
                          <ul className="mt-1 ml-2.5 space-y-1 border-l border-[var(--color-border)] pl-2.5">
                            {sub.subcategories.map(leaf => (
                              <li key={leaf.id}>
                                <button onClick={() => router.push(buildUrl({ cat: leaf.slug }))}
                                  className={`text-[11px] font-light transition-colors ${currentCat === leaf.slug ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}>
                                  {leaf.name}{leaf.productCount !== undefined && leaf.productCount > 0 && <span className="ml-1 text-[10px] text-[var(--color-stone)]/60">({leaf.productCount})</span>}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Colores ── */}
      {availableColors.length > 0 && (
        <div className="border-t border-[var(--color-border)] py-4">
          <SectionHeader label="Color" open={open.colores} onToggle={() => toggle('colores')} active={!!currentColor} />
          {open.colores && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                {availableColors.map(color => {
                  const hex = getColorHex(color)
                  const light = isLight(hex)
                  const active = currentColor === color
                  return (
                    <button
                      key={color}
                      title={color}
                      onClick={() => router.push(buildUrl({ color: active ? undefined : color }))}
                      style={{ backgroundColor: hex }}
                      className={`w-6 h-6 rounded-full transition-all ${active ? 'ring-2 ring-offset-1 ring-[var(--color-charcoal)] scale-110' : 'hover:scale-110'}`}
                      aria-label={color}
                    >
                      {active && (
                        <span className="flex items-center justify-center w-full h-full">
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: light ? '#333' : '#fff', display: 'block' }} />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
              {currentColor && (
                <p className="text-xs text-[var(--color-stone)] mt-2 capitalize">{currentColor}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Talles ── */}
      {availableSizes.length > 0 && (
        <div className="border-t border-[var(--color-border)] py-4">
          <SectionHeader label="Talle" open={open.talles} onToggle={() => toggle('talles')} active={!!currentTalle} />
          {open.talles && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {availableSizes.map(size => {
                const active = currentTalle?.toUpperCase() === size.toUpperCase()
                return (
                  <button
                    key={size}
                    onClick={() => router.push(buildUrl({ talle: active ? undefined : size }))}
                    className={`h-7 px-2.5 text-[11px] border transition-colors rounded-sm ${
                      active
                        ? 'border-[var(--color-charcoal)] bg-[var(--color-charcoal)] text-white'
                        : 'border-[var(--color-border)] text-[var(--color-charcoal)] hover:border-[var(--color-charcoal)]'
                    }`}
                  >
                    {size}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Precio ── */}
      <div className="border-t border-[var(--color-border)] py-4">
        <SectionHeader label="Precio" open={open.precio} onToggle={() => toggle('precio')} active={!!(currentPrecioMin || currentPrecioMax)} />
        {open.precio && (
          <form onSubmit={handlePrecio} className="mt-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={precioMin}
                onChange={e => setPrecioMin(e.target.value)}
                placeholder="Mín"
                className="w-full px-2 py-1.5 border border-[var(--color-border)] bg-white text-xs focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
              />
              <span className="text-[var(--color-stone)] text-xs flex-shrink-0">—</span>
              <input
                type="number"
                min={0}
                value={precioMax}
                onChange={e => setPrecioMax(e.target.value)}
                placeholder="Máx"
                className="w-full px-2 py-1.5 border border-[var(--color-border)] bg-white text-xs focus:outline-none focus:border-[var(--color-charcoal)] transition-colors"
              />
            </div>
            <button type="submit"
              className="w-full py-1.5 border border-[var(--color-charcoal)] text-[10px] tracking-[0.15em] uppercase text-[var(--color-charcoal)] hover:bg-[var(--color-charcoal)] hover:text-white transition-colors">
              Aplicar
            </button>
          </form>
        )}
      </div>

      {/* ── En descuento (siempre visible) ── */}
      <div className="border-t border-[var(--color-border)] py-4">
        <button
          onClick={() => router.push(buildUrl({ descuento: currentDescuento ? undefined : '1' }))}
          className={`flex items-center gap-2 text-sm font-light transition-colors ${currentDescuento ? 'text-[var(--color-charcoal)]' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}
        >
          <span className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${currentDescuento ? 'border-[var(--color-charcoal)] bg-[var(--color-charcoal)]' : 'border-[var(--color-border)]'}`}>
            {currentDescuento && <span style={{ width: 8, height: 8, background: 'white', display: 'block', clipPath: 'polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%)' }} />}
          </span>
          En descuento
        </button>
      </div>

      {/* ── Ordenar ── */}
      <div className="border-t border-[var(--color-border)] py-4">
        <SectionHeader label="Ordenar" open={open.ordenar} onToggle={() => toggle('ordenar')} active={!!currentOrden} />
        {open.ordenar && (
          <ul className="mt-3 space-y-2">
            {[
              { value: '', label: 'Más recientes' },
              { value: 'precio-asc', label: 'Precio: menor a mayor' },
              { value: 'precio-desc', label: 'Precio: mayor a menor' },
              { value: 'nombre-asc', label: 'Nombre A→Z' },
            ].map(opt => (
              <li key={opt.value}>
                <button onClick={() => router.push(buildUrl({ orden: opt.value || undefined }))}
                  className={`text-sm font-light transition-colors ${(currentOrden ?? '') === opt.value ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)] hover:text-[var(--color-charcoal)]'}`}>
                  {opt.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  )
}
