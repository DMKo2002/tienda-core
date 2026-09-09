// ── SEO compartido entre todos los templates de tienda ──────────────────────
// Antes esta lógica (metadata de la home, sitemap.xml, robots.txt) estaba
// duplicada byte a byte en cada uno de los 6 repos de template. Vivir acá
// significa: un solo lugar para arreglar un bug, y que el override que carga
// el tenant desde el Panel Admin (store_config.seo_title / seo_description)
// se respete en todos los templates por igual, sin tener que tocar cada repo.
//
// Uso en cada template:
//   // src/app/layout.tsx
//   import { buildStoreMetadata } from '@creart/tienda-core/seo'
//   export async function generateMetadata() {
//     return buildStoreMetadata('Estilo que trasciende tendencia.') // fallback propio del template
//   }
//
//   // src/app/sitemap.ts
//   export { default } from '@creart/tienda-core/sitemap'
//
//   // src/app/robots.ts
//   export { default } from '@creart/tienda-core/robots'

import type { Metadata, MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabase, getTenantId } from './supabase-server'

// El dominio varía por tenant (custom domain) — no se puede fijar con un env
// var estático compartido por todo el deploy. Se arma desde el host real del
// request, con NEXT_PUBLIC_APP_URL solo como fallback (local/build sin request).
export function getBaseUrl(): string {
  try {
    const h = headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (host && !host.includes('localhost') && !host.startsWith('127.')) {
      const proto = h.get('x-forwarded-proto') ?? 'https'
      return `${proto}://${host}`
    }
  } catch {}
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

/**
 * Metadata de la tienda (home / layout raíz).
 * @param fallbackDescription copy propia de cada template — se usa solo si el
 *   tenant todavía no cargó su propia "Descripción SEO" desde el panel.
 */
export async function buildStoreMetadata(fallbackDescription: string): Promise<Metadata> {
  try {
    const supabase = await createServerSupabase()
    const tenantId = getTenantId()
    const [{ data: tenant }, { data: config }] = await Promise.all([
      supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      supabase
        .from('store_config')
        .select('logo_url, favicon_url, hero_image_url, seo_title, seo_description')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ])
    const storeName = tenant?.name ?? 'Tienda'
    // Título mostrado en Google para la home — si el tenant no cargó uno propio,
    // se usa el nombre de la tienda. El template de sufijo de las demás páginas
    // ("Producto X | Mi Tienda") sigue usando siempre el nombre de marca, nunca
    // este override, para no repetir la misma frase larga en cada página.
    const homeTitle = (config as any)?.seo_title?.trim() || storeName
    const description = (config as any)?.seo_description?.trim() || fallbackDescription
    const faviconUrl = (config as any)?.favicon_url ?? config?.logo_url ?? null
    // Imagen para el preview al compartir el link (WhatsApp, Instagram, etc).
    // Sin esto, compartir la tienda no muestra ninguna imagen — se ve el link pelado.
    const ogImage = (config as any)?.hero_image_url ?? config?.logo_url ?? null
    // metadataBase resuelve cualquier `alternates.canonical` relativo ('/',
    // '/contacto', etc.) que cada page.tsx/layout.tsx declare, usando el
    // dominio real del request (custom domain del tenant o *.gounuri.com) en
    // vez de un dominio fijo -- necesario porque un mismo deploy sirve
    // dominios distintos por tenant. Sin esto, un canonical relativo no
    // tiene con qué resolverse a URL absoluta.
    const baseUrl = getBaseUrl()
    return {
      metadataBase: new URL(baseUrl),
      title: { default: homeTitle, template: `%s | ${storeName}` },
      description,
      alternates: { canonical: '/' },
      ...(faviconUrl ? { icons: { icon: faviconUrl, apple: faviconUrl } } : {}),
      openGraph: {
        title: homeTitle,
        description,
        siteName: storeName,
        locale: 'es_AR',
        type: 'website',
        ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
      },
      twitter: {
        card: 'summary_large_image',
        title: homeTitle,
        description,
        ...(ogImage ? { images: [ogImage] } : {}),
      },
    }
  } catch {
    return {
      title: { default: 'Tienda', template: '%s | Tienda' },
      description: fallbackDescription,
    }
  }
}

// Sitemap dinámico — se regenera con cada build o con revalidación.
// Usa el cliente anon (no service role): alcanza con leer productos/categorías
// activos, que ya son públicos vía RLS para el storefront.
export async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const BASE_URL = getBaseUrl()
  const tenantId = getTenantId()

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('slug, updated_at').eq('tenant_id', tenantId).eq('active', true),
    supabase.from('categories').select('slug').eq('tenant_id', tenantId).eq('active', true),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), priority: 1.0, changeFrequency: 'weekly' as const },
    { url: `${BASE_URL}/tienda`, lastModified: new Date(), priority: 0.9, changeFrequency: 'daily' as const },
  ]

  const productRoutes: MetadataRoute.Sitemap = (products ?? []).map(p => ({
    url: `${BASE_URL}/tienda/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
    priority: 0.8,
    changeFrequency: 'weekly' as const,
  }))

  const categoryRoutes: MetadataRoute.Sitemap = (categories ?? [])
    .filter(c => c.slug)
    .map(c => ({
      url: `${BASE_URL}/tienda?cat=${c.slug}`,
      lastModified: new Date(),
      priority: 0.6,
      changeFrequency: 'weekly' as const,
    }))

  return [...staticRoutes, ...productRoutes, ...categoryRoutes]
}

export function buildRobots(): MetadataRoute.Robots {
  const BASE_URL = getBaseUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/checkout', '/carrito', '/cuenta', '/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}

// ── Datos estructurados (JSON-LD) ────────────────────────────────────────
// Antes esto vivía duplicado byte a byte en cada uno de los 6 templates
// (src/app/tienda/[slug]/page.tsx), con un bug: el campo `offers.url` usaba
// `process.env.NEXT_PUBLIC_APP_URL`, una env var fija de build, en vez del
// dominio real del tenant (custom domain o *.gounuri.com) — Google recibía
// una URL de producto que no correspondía al dominio real. Ver diagnóstico
// 2026-09-09 (indexación de mykonoslove.com / yeninesweaters.com).

/**
 * JSON-LD de un producto (página /tienda/[slug]).
 * El caller pasa los datos ya calculados (precio, imagen de portada) porque
 * cada template ya los resuelve para renderizar la página — evita duplicar
 * esa lógica de negocio (reglas de precio, imagen de portada) acá.
 */
export function buildProductJsonLd(
  product: { name: string; description?: string | null; slug: string; sku?: string | null },
  storeName: string,
  retailPrice: number | undefined,
  coverImage?: string | null
): Record<string, any> {
  const baseUrl = getBaseUrl()
  return {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? `${product.name} - ${storeName}`,
    ...(coverImage ? { image: [coverImage] } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...(retailPrice
      ? {
          offers: {
            '@type': 'Offer',
            url: `${baseUrl}/tienda/${product.slug}`,
            priceCurrency: 'ARS',
            price: retailPrice,
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: storeName },
          },
        }
      : {}),
  }
}

/**
 * JSON-LD de la tienda como Organization (home / layout raíz). Consulta sus
 * propios datos (igual que buildStoreMetadata) para no forzar a cada layout
 * a resolver tenant/config solo para esto.
 */
export async function buildOrganizationJsonLd(): Promise<Record<string, any> | null> {
  try {
    const supabase = await createServerSupabase()
    const tenantId = getTenantId()
    const [{ data: tenant }, { data: config }] = await Promise.all([
      supabase.from('tenants').select('name').eq('id', tenantId).maybeSingle(),
      supabase
        .from('store_config')
        .select('logo_url, whatsapp_number, instagram_url, facebook_url, tiktok_url')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
    ])
    if (!tenant) return null

    const baseUrl = getBaseUrl()
    const sameAs = [
      (config as any)?.instagram_url,
      (config as any)?.facebook_url,
      (config as any)?.tiktok_url,
    ].filter(Boolean)

    return {
      '@context': 'https://schema.org/',
      '@type': 'Organization',
      name: tenant.name,
      url: baseUrl,
      ...((config as any)?.logo_url ? { logo: (config as any).logo_url } : {}),
      ...(sameAs.length ? { sameAs } : {}),
      ...((config as any)?.whatsapp_number
        ? {
            contactPoint: {
              '@type': 'ContactPoint',
              telephone: (config as any).whatsapp_number,
              contactType: 'customer service',
            },
          }
        : {}),
    }
  } catch {
    return null
  }
}
