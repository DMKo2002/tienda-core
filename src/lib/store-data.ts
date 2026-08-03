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
  'instagram_url',
  'facebook_url',
  'tiktok_url',
  'branches',
  'video_360_url',
  'price_visibility',
  'product_image_ratio',
  'ignore_stock',
  'interest_free_installments',
  'variant_column_type',
  'variant_row_label',
  'variant_column_label',
  'min_qty_per_variant',
  'registration_visibility',
  'privacy_policy',
  'cookies_policy',
  'terms_and_conditions',
  'transfer_cbu',
  'transfer_alias',
  'mp_access_token',
  'mp_enabled',
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
  'instagram_url',
  'facebook_url',
  'tiktok_url',
  'branches',
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
  const [tenantRes, configRes] = await Promise.all([
    supabase.from('tenants').select('name, domain').eq('id', tenantId).single(),
    supabase.from('store_config').select(FUNCTIONAL_FIELDS).eq('tenant_id', tenantId).single(),
  ])

  if (tenantRes.error) {
    console.error('[getStoreData] tenants query failed:', tenantRes.error.message)
  }

  let config = (configRes.data as StoreConfig) ?? null

  if (configRes.error) {
    console.error(
      `[getStoreData] store_config (functional) query failed for tenant ${tenantId}:`,
      configRes.error.message
    )
    const fallback = await supabase
      .from('store_config')
      .select(MINIMAL_FIELDS)
      .eq('tenant_id', tenantId)
      .single()
    if (fallback.error) {
      console.error(
        `[getStoreData] minimal fallback ALSO failed for tenant ${tenantId}:`,
        fallback.error.message
      )
    }
    config = (fallback.data as StoreConfig) ?? null
  }

  return {
    tenant: (tenantRes.data as StoreTenant) ?? null,
    config,
  }
}
