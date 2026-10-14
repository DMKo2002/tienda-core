'use client'

import { useState, useEffect, useRef } from 'react'

// Buscador de localidades (API Georef del Estado argentino). Compartido por el
// checkout y "Mis datos" para que ambos pidan la localidad de la misma forma:
// se escribe, aparece una lista de opciones y se elige una.
//
// `value` es la localidad confirmada (la que se guarda); lo que el usuario
// tipea vive en `query` hasta que elige una opción.
export default function LocalidadAutocomplete({ value, provincia, onChange, inputClass }: {
  value: string; provincia: string; onChange: (v: string) => void; inputClass: string
}) {
  const [query, setQuery] = useState(value)
  const [sugerencias, setSugerencias] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [falloBusqueda, setFalloBusqueda] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const provinciaPrevRef = useRef(provincia)

  // Si el valor viene de afuera (precarga de datos guardados), lo mostramos.
  useEffect(() => { if (value && value !== query) setQuery(value) }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar de provincia la localidad deja de ser válida. No limpiamos
  // cuando la provincia pasa de vacía a un valor (eso es la precarga de datos
  // guardados, no un cambio del usuario) ni en el montaje.
  useEffect(() => {
    const prev = provinciaPrevRef.current
    provinciaPrevRef.current = provincia
    if (prev && prev !== provincia) { setQuery(''); onChange(''); setSugerencias([]) }
  }, [provincia]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleInput(v: string) {
    setQuery(v); onChange('')
    setFalloBusqueda(false)
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
      } catch { setSugerencias([]); setFalloBusqueda(true) } finally { setBuscando(false) }
    }, 300)
  }

  // Al salir del campo sin haber elegido: si lo escrito coincide con una
  // opción, la tomamos; si el buscador falló (API caída), aceptamos el texto
  // para no dejar al cliente trabado.
  function handleBlur() {
    if (value || !query.trim()) return
    const exacta = sugerencias.find(s => s.toLowerCase() === query.trim().toLowerCase())
    if (exacta) { setQuery(exacta); onChange(exacta); return }
    if (falloBusqueda) onChange(query.trim())
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
        onBlur={() => setTimeout(handleBlur, 150)}
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
