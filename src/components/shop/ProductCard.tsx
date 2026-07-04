'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'

interface ProductCardProps {
  id: string
  name: string
  slug: string
  coverUrl?: string | null
  retailPrice?: number | null
  retailCompareAt?: number | null
  wholesalePrice?: number | null
  showWholesale?: boolean
  showPrices?: boolean
  priceVisibility?: 'all' | 'logged_in' | 'wholesale_only'
  isRetailUser?: boolean
  index?: number
  colors?: string[]
  sizes?: string[]
}

const formatPrice = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)

// Mapa de nombres de color en español → hex (claves ya normalizadas: sin acentos, con espacios)
const COLOR_MAP: Record<string, string> = {
  negro: '#1C1C1C', 'negro azabache': '#0D0D0D', 'blanco roto': '#F5F1E8',
  blanco: '#F5F5F0', crudo: '#EFE8DA', crema: '#F0EBE1', hueso: '#F0E9DC', natural: '#EAE2D2',
  beige: '#D4C5A9', 'beige claro': '#E8DCC8', 'beige oscuro': '#B8A57F', 'beige moka': '#C8B89A',
  'french beige': '#D4C5A9', arena: '#C8B89A', marfil: '#FFFFF0',
  gris: '#9E9E9E', 'gris claro': '#D0D0D0', 'gris oscuro': '#555555', 'gris topo': '#8B8378',
  'gris perla': '#C7C7C7', 'gris plomo': '#6E6E6E', 'gris piedra': '#A8A398',
  plateado: '#C0C0C0', plata: '#C0C0C0',
  rojo: '#C0392B', bordo: '#7B2D42', bordeaux: '#7B2D42', borgona: '#7B2D42',
  granate: '#6B1F2A', vino: '#6B2737', cereza: '#9B2242', ladrillo: '#B24C3C',
  rosa: '#E8A0B0', 'rosa palido': '#F2C4CE', 'rosa pastel': '#F2C4CE', 'rosa viejo': '#C99AA0',
  fucsia: '#D6249F', salmon: '#E8957A',
  coral: '#E8714A', naranja: '#E8813A', terracota: '#C1440E', cobre: '#B87333', cobrizo: '#B26A45',
  mostaza: '#C8A84B', 'amarillo mostaza': '#C8A84B', amarillo: '#F0CC4A', 'amarillo pastel': '#F5E6A8',
  ocre: '#CC9A3A', dorado: '#D4AF37', oro: '#D4AF37', bronce: '#8C6B3F', champagne: '#F0E4D0',
  azul: '#3A7BC8', 'azul marino': '#1B3A6B', 'azul noche': '#0F2A4A', 'azul rey': '#1E4CA1',
  'azul frances': '#3163C4', 'azul claro': '#7EB8E0', 'azul palido': '#B0C4DE', 'azul acero': '#7A9BB5',
  'azul petroleo': '#1B4F5C', celeste: '#87CEEB', 'celeste pastel': '#B8DCE0', 'celeste palido': '#A8C8CA',
  denim: '#4A6A8A', jean: '#4A6A8A',
  verde: '#4A9B6F', 'verde oscuro': '#2D6A4F', 'verde ingles': '#2F5233', 'verde militar': '#4B5320',
  'verde oliva': '#6B6E3A', oliva: '#6B6E3A', 'verde agua': '#7BBFB5', 'verde botella': '#1D4A34',
  esmeralda: '#2E8B6E', turquesa: '#3AADA8',
  lila: '#B09BC8', violeta: '#8E44AD', morado: '#6C3483', lavanda: '#C8B8DC', uva: '#5B2A5C', berenjena: '#4C2A3C',
  camel: '#C19A6B', tostado: '#A97C50', canela: '#A9673A', cognac: '#9A5B2E', tabaco: '#8B6355',
  chocolate: '#5C3A1E', marron: '#6B4226', cafe: '#5C3A1E', caqui: '#A89870', khaki: '#A89870',
  tiza: '#E8E4DC', off: '#F5F2EC', moka: '#6F4E37', marino: '#1B3A6B', vison: '#8A7967',
  reptil: '#7A6A4F', zebra: '#3D3D3D',
  'rose gold': '#B76E79', 'lima neon': '#C4D82E',
}

const ALIASES: Record<string, string> = {
  borgona: 'bordo', bordeaux: 'bordo', burdeos: 'bordo',
  cafe: 'chocolate', marron: 'chocolate',
  khaki: 'caqui', plata: 'plateado', oro: 'dorado',
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function normalizeColor(input: string): string {
  return stripAccents(input).toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const SORTED_COLOR_KEYS = Object.keys(COLOR_MAP).sort((a, b) => b.length - a.length)

function getColorHex(name: string): string {
  const trimmed = (name ?? '').trim()
  if (!trimmed) return '#CCCCCC'
  if (/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return trimmed

  const norm = normalizeColor(trimmed)

  if (COLOR_MAP[norm]) return COLOR_MAP[norm]
  if (ALIASES[norm] && COLOR_MAP[ALIASES[norm]]) return COLOR_MAP[ALIASES[norm]]

  const stripped = norm.replace(/\s*\d+$/, '').trim()
  if (COLOR_MAP[stripped]) return COLOR_MAP[stripped]
  if (ALIASES[stripped] && COLOR_MAP[ALIASES[stripped]]) return COLOR_MAP[ALIASES[stripped]]

  for (const key of SORTED_COLOR_KEYS) {
    if (stripped.includes(key)) return COLOR_MAP[key]
  }

  const words = stripped.split(' ').filter(Boolean)
  if (words.length > 1) {
    if (COLOR_MAP[words[0]]) return COLOR_MAP[words[0]]
    if (COLOR_MAP[words[words.length - 1]]) return COLOR_MAP[words[words.length - 1]]
  }

  return '#CCCCCC'
}

function isLight(hex: string): boolean {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 180
}

export default function ProductCard({
  id, name, slug, coverUrl, retailPrice, retailCompareAt, wholesalePrice,
  showWholesale = false, showPrices = true, priceVisibility = 'all', isRetailUser = false, index = 0, colors = [], sizes = []
}: ProductCardProps) {

  // Props pre-procesadas desde tienda/page.tsx:
  //   retailPrice     = precio efectivo (lo que paga el cliente, ej: 18000)
  //   retailCompareAt = precio regular tachado (el más alto, ej: 20000)
  const hasDiscount = !!(retailCompareAt && retailCompareAt > (retailPrice ?? 0))
  const salePrice   = retailPrice
  const discountPct = hasDiscount
    ? Math.round((1 - retailPrice! / retailCompareAt!) * 100)
    : null

  return (
    <Link
      href={`/tienda/${slug}`}
      className="group block opacity-0 animate-fade-up"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'forwards' }}
    >
      {/* Imagen */}
      <div className="product-img-wrap bg-[#F2EEE9] aspect-[3/4] w-full mb-3 relative overflow-hidden">
        {coverUrl ? (
          <Image
            src={coverUrl.split('?')[0]}
            alt={name}
            fill
            className="object-cover transition-opacity duration-300"
            sizes="(max-width: 768px) 50vw, 25vw"
            priority={index < 6}
            loading={index < 6 ? 'eager' : 'lazy'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff size={32} className="text-[var(--color-border)]" />
          </div>
        )}

        {/* Badge descuento */}
        {discountPct && (
          <div className="absolute top-2 left-2 bg-[var(--color-charcoal)] text-white text-[10px] tracking-[0.1em] uppercase px-2 py-1">
            -{discountPct}%
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <p className="text-sm font-light text-[var(--color-charcoal)] leading-snug group-hover:text-[var(--color-stone)] transition-colors mb-1.5">
          {name}
        </p>

        {/* Precio */}
        <div className="flex items-center gap-2 mb-2.5">