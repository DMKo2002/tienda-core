import type { SupabaseClient } from '@supabase/supabase-js'

export interface StoreBranch {
  name: string
  address: string
  phone?: string
}

export interface StoreTenant {
  name: string
  domain?: string | null
}

export type StoreConfig = Record<string, any>

// Solo campos de NEGOCIO/funcionales, idénticos en las 6 tiendas (contacto,
// footer, checkout, reglas de variantes, legales). La Apariencia (hero,
// colores de tema, blog, newsletter) es propia de cada demo — cada tienda
// la consulta por su cuenta directo a store_config, no vive acá. Ver charla
// del 2026-08-03: un select('*') centralizado rompió el footer/logo en las
// 6 tiendas a la vez cuando una sola columna de store_config falló; la
// lista explícita evita que un campo roto tire abajo todo lo demás, y
// mantiene la Apariencia desacoplada de tienda-core como estaba pensado
// desde el inicio.
const FUNCTIONAL_FIELDS = [
  'logo_url',
  'favicon_url',
  'whatsapp_number',
  'notification_email',
  'contact_email',
  'instagram_url',
  'facebook_url',
  'tiktok_url',
  'branches',
  'pickup_address',
  'video_360_url',
  'price_visibility',
  'product_image_ratio',
  'ignore_stock',
  'interest_free_installments',
  'variant_column_type',
  'variant_row_label',
  'variant_column_label',
  // Config de labels de los atributos adicionales del tenant (ej: la key
  // "contenido_neto" -> label "Contenido neto") — la necesita ProductAttributes
  // para mostrar un nombre lindo en vez de la key cruda guardada en
  // variants.attributes. Ver ProductAttributes.tsx.
  'variant_attributes',
  'min_qty_per_variant',
  'registration_visibility',
  'privacy_policy',
  'cookies_policy',
  'terms_and_conditions',
  'transfer_cbu',
  'transfer_alias',
  'mp_enabled',
  // OJO: mp_access_token NO va acá. Es el token secreto de MercadoPago del
  // tenant y anon NO tiene permiso de leerlo (a propósito, ver comentario en
  // src/api/mp-preferencia.ts) — incluirlo acá tira "permission denied" en
  // TODO el pedido, no solo en ese campo, y así se cayeron footer/logo en
  // varias tiendas el 2026-08-03. El checkout ya lo lee aparte con el
  // service client (mp-preferencia.ts, mp-crear-pago.ts) — no hace falta acá.
].join(', ')

// Ultra-reducido: solo lo que necesita el footer/logo. Si el select con
// FUNCTIONAL_FIELDS falla para un tenant puntual (hay al menos una columna
// con datos rotos en ALGUNAS tiendas, todavia sin identificar - ver log de
// consola en Vercel), reintentamos con esto para no perder nunca footer ni
// logo, aunque se pierdan datos de checkout/legales en ese pedido puntual.
const MINIMAL_FIELDS = [
  'logo_url',
  'whatsapp_number',
  'notification_email',
  'contact_email',
  'instagram_url',
  'facebook_url',
  'tiktok_url',
  'branches',
  'pickup_address',
].join(', ')

/**
 * Trae tenant + los campos funcionales de store_config (contacto, footer,
 * checkout, legales) de una sola vez, con manejo de errores centralizado.
 * Los campos de Apariencia (hero_*, nav_text_color, collection_*, blog_*,
 * newsletter_bg_color) NO están acá — cada tienda los consulta por su cuenta.
 *
 * Uso en un server component:
 *   const supabase = await createServerSupabase()
 *   const { tenant, config } = await getStoreData(supabase, TENANT_ID())
 */
export async function getStoreData(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ tenant: StoreTenant | null; config: StoreConfig | null }> {
  // OJO: .limit(1) en vez de .single() a propósito. .single() exige que
  // haya EXACTAMENTE 1 fila y tira error si hay 0 o 2+ (fila duplicada
  // o faltante para ese tenant_id) — eso rompe el pedido entero aunque
  // todas las columnas estén perfectas. Con .limit(1) + tomar el primer
  // elemento, nunca explota por cantidad de filas; en el peor caso, si
  // hay una fila vieja duplicada, muestra la primera que encuentre.
  const [tenantRes, configRes] = await Promise.all([
    supabase.from('tenants').select('name, domain').eq('id', tenantId).limit(1),
    supabase.from('store_config').select(FUNCTIONAL_FIELDS).eq('tenant_id', tenantId).limit(1),
  ])

  if (tenantRes.error) {
    console.error('[getStoreData] tenants query failed:', tenantRes.error.message)
  }

  let config = ((configRes.data?.[0] as StoreConfig) ?? null)

  if (configRes.error) {
    console.error(
      `[getStoreData] store_config (functional) query failed for tenant ${tenantId}:`,
      configRes.error.message
    )
    const fallback = await supabase
      .from('store_config')
      .select(MINIMAL_FIELDS)
      .eq('tenant_id', tenantId)
      .limit(1)
    if (fallback.error) {
      console.error(
        `[getStoreData] minimal fallback ALSO failed for tenant ${tenantId}:`,
        fallback.error.message
      )
    }
    config = (fallback.data?.[0] as StoreConfig) ?? null
  }

  return {
    tenant: (tenantRes.data?.[0] as StoreTenant) ?? null,
    config,
  }
}
