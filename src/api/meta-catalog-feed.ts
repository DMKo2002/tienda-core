import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, TENANT_ID } from '../lib/supabase-server'

// Feed de catálogo para Meta Commerce Manager (Facebook/Instagram Shops,
// anuncios dinámicos, retargeting). Genera un CSV con los productos activos
// del tenant actual, usando siempre los datos vivos de la base — nunca hay
// que subirlo a mano ni volver a exportarlo.
//
// Cómo se configura del lado de Meta (una sola vez, por tenant):
//   Commerce Manager → Catálogo → Orígenes de datos → Agregar productos →
//   "Feed de datos" → pegar la URL https://{dominio-del-tenant}/feed/meta-catalog.csv
//   → elegir una frecuencia de actualización (diaria recomendada).
// A partir de ahí Meta vuelve a buscar esta URL solo, en el horario que se
// configure — nosotros no llamamos a ninguna API de Meta, solo mantenemos
// esta respuesta siempre al día.
//
// Por qué existe: cuando un tenant migra desde otra plataforma (WooCommerce,
// etc.) que ya tenía un catálogo de Meta conectado, ese catálogo queda con
// los IDs y links viejos — ver MIGRATION_PLAYBOOK.md, sección "Catálogo de
// Meta". Configurar este feed como nuevo origen de datos reemplaza esa
// conexión vieja con una que sigue viva mientras la tienda cambie.

export const revalidate = 0 // siempre datos frescos, Meta trae su propia caché

type PriceRule = {
  type: string
  min_qty: number | null
  price: number
  compare_at_price: number | null
  active: boolean
}

type Variant = {
  id: string
  size: string | null
  color: string | null
  stock: number | null
  active: boolean
  price_rules: PriceRule[]
}

type ProductImage = {
  url: string
  is_cover: boolean | null
  sort_order: number | null
}

type Product = {
  id: string
  name: string
  description: string | null
  slug: string
  variants: Variant[]
  product_images: ProductImage[]
}

// Misma prioridad de precio que ProductPrice.tsx: retail (con oferta si hay
// compare_at_price menor) primero; si el producto no tiene precio retail
// (tiendas 100% mayoristas, como Yenine hoy) cae al wholesale de menor
// min_qty — es el único precio "público" que existe en ese caso.
function resolvePrice(rules: PriceRule[]): { price: number; compareAt: number | null } | null {
  const active = rules.filter(r => r.active)
  const retail = active.find(r => r.type === 'retail')
  if (retail) {
    const compareAt =
      retail.compare_at_price && retail.compare_at_price > 0 && retail.compare_at_price < retail.price
        ? retail.price
        : null
    return { price: compareAt ?? retail.price, compareAt: compareAt ? retail.price : null }
  }
  const wholesale = active
    .filter(r => r.type === 'wholesale')
    .sort((a, b) => (a.min_qty ?? 1) - (b.min_qty ?? 1))[0]
  if (wholesale) return { price: wholesale.price, compareAt: null }
  return null
}

function coverImage(images: ProductImage[]): string | null {
  if (images.length === 0) return null
  const sorted = [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1
    if (b.is_cover && !a.is_cover) return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  return sorted[0].url
}

// Escapeo CSV estándar (RFC 4180): comillas dobles alrededor de cualquier
// campo con coma, comilla o salto de línea; comillas internas se duplican.
function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

const CSV_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'item_group_id',
  'color',
  'size',
] as const

export async function GET(request: NextRequest) {
  const tenantId = TENANT_ID()
  const supabase = await createServerSupabase()

  const host = request.headers.get('host') ?? request.nextUrl.host
  const baseUrl = `https://${host}`

  const [{ data: tenant }, { data: products }] = await Promise.all([
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
    supabase
      .from('products')
      .select(
        `id, name, description, slug,
         variants(id, size, color, stock, active,
           price_rules(type, min_qty, price, compare_at_price, active)),
         product_images(url, is_cover, sort_order)`
      )
      .eq('tenant_id', tenantId)
      .eq('active', true),
  ])

  const brand = tenant?.name ?? ''
  const rows: string[] = [CSV_COLUMNS.join(',')]

  for (const product of (products ?? []) as Product[]) {
    const imageLink = coverImage(product.product_images ?? [])
    if (!imageLink) continue // Meta rechaza items sin imagen — mejor omitir que mandar vacío

    const link = `${baseUrl}/tienda/${product.slug}`

    for (const variant of product.variants ?? []) {
      if (!variant.active) continue
      const resolved = resolvePrice(variant.price_rules ?? [])
      if (!resolved) continue // sin ninguna price_rule utilizable — no se puede anunciar sin precio

      const availability = (variant.stock ?? 0) > 0 ? 'in stock' : 'out of stock'
      const price = `${resolved.price.toFixed(2)} ARS`

      rows.push(
        [
          variant.id,
          product.name,
          product.description ?? '',
          availability,
          'new',
          price,
          link,
          imageLink,
          brand,
          product.id,
          variant.color ?? '',
          variant.size ?? '',
        ]
          .map(v => csvField(String(v)))
          .join(',')
      )
    }
  }

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=3600', // 1h — suficiente margen entre re-fetches de Meta
    },
  })
}
