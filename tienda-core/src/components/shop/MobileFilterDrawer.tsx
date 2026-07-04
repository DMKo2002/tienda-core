'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, SlidersHorizontal, ChevronDown } from 'lucide-react'

interface Subcategory {
  id: string; name: string; slug: string
  subcategories?: { id: string; name: string; slug: string }[]
}
interface Category {
  id: string; name: string; slug: string
  productCount?: number
  subcategories: Subcategory[]
}

interface Props {
  categories: Category[]
  availableColors: string[]
  availableSizes: string[]
  currentCat?: string
  currentOrden?: string
  currentQ?: string
  currentColor?: string
  currentTalle?: string
  currentPrecioMin?: number
  currentPrecioMax?: number
  currentDescuento?: boolean
  activeFilterCount: number
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
function getHex(name: string) {
  if (/^#[0-9A-Fa-f]{3,6}$/.test(name.trim())) return name.trim()
  return COLOR_MAP[name.toLowerCase().trim()] ?? '#CCCCCC'
}
function isLight(hex: string) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return (r*299+g*587+b*114)/1000 > 180
}

function SectionHeader({ label, open, onToggle, active }: { label: string; open: boolean; onToggle: () => void; active?: boolean }) {
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between py-1">
      <p className={`text-[10px] tracking-[0.2em] uppercase ${active ? 'text-[var(--color-charcoal)]' : 'text-[var(--color-stone)]'}`}>
        {label}{active ? ' ·' : ''}
      </p>
      <ChevronDown size={13} className={`text-[var(--color-stone)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
    </button>
  )
}

export default function MobileFilterDrawer({
  categories, availableColors, availableSizes,
  currentCat, currentOrden, currentQ, currentColor, currentTalle,
  currentPrecioMin, currentPrecioMax, currentDescuento,
  activeFilterCount,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [precioMin, setPrecioMin] = useState(String(currentPrecioMin ?? ''))
  const [precioMax, setPrecioMax] = useState(String(currentPrecioMax ?? ''))
  const router = useRouter()

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

  function buildUrl(overrides: Record<string, string | undefined>) {
    const p: Record<string, string> = {}
    if (currentCat) p.cat = currentCat
    if (currentOrden) p.orden = currentOrden
    if (currentQ) p.q = currentQ
    if (currentColor) p.color = currentColor
    if (currentTalle) p.talle = currentTalle
    if (currentPrecioMin) p.precio_min = String(currentPrecioMin)
    if (currentPrecioMax) p.precio_max = String(currentPrecioMax)
    if (currentDescuento) p.descuento = '1'
    Object.entries(overrides).forEach(([k,v]) => { if (!v) delete p[k]; else p[k]=v })
    const qs = new URLSearchParams(p).toString()
    return `/tienda${qs ? '?'+qs : ''}`
  }

  function go(url: string) { router.push(url); setDrawerOpen(false) }

  function applyPrecio(e: React.FormEvent) {
    e.preventDefault()
    go(buildUrl({ precio_min: precioMin||undefined, precio_max: precioMax||undefined }))
  }

  return (
    <>
      {/* Botón sticky arriba */}
      <div className="flex items-center justify-between mb-5 md:hidden">
        <p className="text-xs text-[var(--color-stone)] font-light">
          {activeFilterCount > 0 ? `${activeFilterCount} filtro${activeFilterCount>1?'s':''} activo${activeFilterCount>1?'s':''}` : ''}
        </p>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 border border-[var(--color-charcoal)] text-xs tracking-[0.12em] uppercase text-[var(--color-charcoal)]"
        >
          <SlidersHorizontal size={13} strokeWidth={1.5} />
          Filtrar{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {/* Drawer overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />

          <div className="absolute top-0 right-0 bottom-0 w-[85vw] max-w-sm bg-[var(--color-warm-white)] overflow-y-auto flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-warm-white)] z-10">
              <p className="text-xs tracking-[0.2em] uppercase text-[var(--color-charcoal)]">Filtros</p>
              <button onClick={() => setDrawerOpen(false)}>
                <X size={18} strokeWidth={1.5} className="text-[var(--color-charcoal)]" />
              </button>
            </div>

            <div className="flex-1 px-5 py-2">

              {/* Categorías */}
              <div className="border-b border-[var(--color-border)] py-4">
                <SectionHeader label="Categorías" open={open.categorias} onToggle={() => toggle('categorias')} active={!!currentCat} />
                {open.categorias && (
                  <ul className="mt-3 space-y-2">
                    <li>
                      <button onClick={() => go(buildUrl({cat:undefined}))}
                        className={`text-sm font-light transition-colors ${!currentCat ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)]'}`}>
                        Todos
                      </button>
                    </li>
                    {categories.map(cat => (
                      <li key={cat.id}>
                        <button onClick={() => go(buildUrl({cat:cat.slug}))}
                          className={`text-sm font-light transition-colors ${currentCat===cat.slug ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)]'}`}>
                          {cat.name}{cat.productCount ? <span className="ml-1 text-[10px] text-[var(--color-stone)]/60">({cat.productCount})</span> : null}
                        </button>
                        {cat.subcategories.length > 0 && (
                          <ul className="mt-1.5 ml-3 space-y-1.5 border-l border-[var(--color-border)] pl-3">
                            {cat.subcategories.map(sub => (
                              <li key={sub.id}>
                                <button onClick={() => go(buildUrl({cat:sub.slug}))}
                                  className={`text-xs font-light transition-colors ${currentCat===sub.slug ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)]'}`}>
                                  {sub.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Colores */}
              {availableColors.length > 0 && (
                <div className="border-b border-[var(--color-border)] py-4">
                  <SectionHeader label="Color" open={open.colores} onToggle={() => toggle('colores')} active={!!currentColor} />
                  {open.colores && (
                    <div className="mt-3">
                      <div className="flex flex-wrap gap-2">
                        {availableColors.map(color => {
                          const hex = getHex(color)
                          const light = isLight(hex)
                          const active = currentColor === color
                          return (
                            <button key={color} title={color}
                              onClick={() => go(buildUrl({color: active ? undefined : color}))}
                              style={{backgroundColor: hex}}
                              className={`w-7 h-7 rounded-full transition-all ${active ? 'ring-2 ring-offset-1 ring-[var(--color-charcoal)] scale-110' : ''}`}
                              aria-label={color}
                            >
                              {active && <span className="flex items-center justify-center w-full h-full">
                                <span style={{width:7,height:7,borderRadius:'50%',background:light?'#333':'#fff',display:'block'}} />
                              </span>}
                            </button>
                          )
                        })}
                      </div>
                      {currentColor && <p className="text-xs text-[var(--color-stone)] mt-2 capitalize">{currentColor}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Talles */}
              {availableSizes.length > 0 && (
                <div className="border-b border-[var(--color-border)] py-4">
                  <SectionHeader label="Talle" open={open.talles} onToggle={() => toggle('talles')} active={!!currentTalle} />
                  {open.talles && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {availableSizes.map(size => {
                        const active = currentTalle?.toUpperCase() === size.toUpperCase()
                        return (
                          <button key={size}
                            onClick={() => go(buildUrl({ talle: active ? undefined : size }))}
                            className={`h-8 px-3 text-xs border transition-colors rounded-sm ${
                              active
                                ? 'border-[var(--color-charcoal)] bg-[var(--color-charcoal)] text-white'
                                : 'border-[var(--color-border)] text-[var(--color-charcoal)]'
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

              {/* Precio */}
              <div className="border-b border-[var(--color-border)] py-4">
                <SectionHeader label="Precio" open={open.precio} onToggle={() => toggle('precio')} active={!!(currentPrecioMin || currentPrecioMax)} />
                {open.precio && (
                  <form onSubmit={applyPrecio} className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} value={precioMin} onChange={e=>setPrecioMin(e.target.value)} placeholder="Mín"
                        className="w-full px-2 py-2 border border-[var(--color-border)] bg-white text-sm focus:outline-none" />
                      <span className="text-[var(--color-stone)] text-xs flex-shrink-0">—</span>
                      <input type="number" min={0} value={precioMax} onChange={e=>setPrecioMax(e.target.value)} placeholder="Máx"
                        className="w-full px-2 py-2 border border-[var(--color-border)] bg-white text-sm focus:outline-none" />
                    </div>
                    <button type="submit"
                      className="w-full py-2 border border-[var(--color-charcoal)] text-[10px] tracking-[0.15em] uppercase text-[var(--color-charcoal)]">
                      Aplicar
                    </button>
                  </form>
                )}
              </div>

              {/* Descuento */}
              <div className="border-b border-[var(--color-border)] py-4">
                <button onClick={() => go(buildUrl({descuento: currentDescuento ? undefined : '1'}))}
                  className={`flex items-center gap-2 text-sm font-light transition-colors ${currentDescuento ? 'text-[var(--color-charcoal)]' : 'text-[var(--color-stone)]'}`}>
                  <span className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${currentDescuento ? 'border-[var(--color-charcoal)] bg-[var(--color-charcoal)]' : 'border-[var(--color-border)]'}`}>
                    {currentDescuento && <span style={{width:8,height:8,background:'white',display:'block',clipPath:'polygon(14% 44%,0 65%,50% 100%,100% 16%,80% 0%,43% 62%)'}} />}
                  </span>
                  En descuento
                </button>
              </div>

              {/* Ordenar */}
              <div className="py-4">
                <SectionHeader label="Ordenar" open={open.ordenar} onToggle={() => toggle('ordenar')} active={!!currentOrden} />
                {open.ordenar && (
                  <ul className="mt-3 space-y-2">
                    {[{value:'',label:'Más recientes'},{value:'precio-asc',label:'Precio: menor a mayor'},
                      {value:'precio-desc',label:'Precio: mayor a menor'},{value:'nombre-asc',label:'Nombre A→Z'}]
                      .map(opt => (
                      <li key={opt.value}>
                        <button onClick={() => go(buildUrl({orden:opt.value||undefined}))}
                          className={`text-sm font-light transition-colors ${(currentOrden??'')===opt.value ? 'text-[var(--color-charcoal)] border-b border-[var(--color-charcoal)]' : 'text-[var(--color-stone)]'}`}>
                          {opt.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>

            {/* Footer — limpiar */}
            {(currentCat||currentColor||currentTalle||currentPrecioMin||currentPrecioMax||currentDescuento||currentQ) && (
              <div className="px-5 py-4 border-t border-[var(--color-border)]">
                <button onClick={() => go('/tienda')}
                  className="w-full py-2.5 text-xs tracking-[0.15em] uppercase text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors underline">
                  Limpiar todos los filtros
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
