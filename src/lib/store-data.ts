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

// Cada tienda usa un subconjunto distinto de columnas de store_config (temas
// visuales, hero de texto vs. banners, redes, sucursales, etc.) y la tabla
// sigue creciendo con el tiempo. En vez de listar columnas a mano por tienda
// (fragil: si se agrega/renombra una columna hay que tocar 6 repos, y si UNA
// sola falla o no existe, Postgres hace fallar TODO el pedido en silencio),
// devolvemos el objeto completo y cada pagina lee los campos que le importan.
export type StoreConfig = Record<string, any>

/**
 * Trae tenant + store_config de una sola vez, con manejo de errores
 * centralizado. Usa select('*') a proposito — nunca falla por una columna en
 * particular, a diferencia de listar columnas puntuales por nombre.
 *
 * Uso en un server component:
 *   const supabase = await createServerSupabase()
 *   const { tenant, config } = await getStoreData(supabase, TENANT_ID())
 *
 * Uso en un client component:
 *   const supabase = createClient()
 *   const { tenant, config } = await getStoreData(supabase, TENANT_ID())
 */
// Campos "núcleo" — probados y estables (footer, navbar, contacto). Si el
// select('*') de abajo falla por CUALQUIER motivo (una columna nueva rota,
// un tipo de dato que Postgrest no puede serializar, un permiso puntual,
// etc.), se reintenta con esta lista angosta para no perder nunca los datos
// esenciales de contacto — mejor una tienda con menos funciones avanzadas
// que un footer vacío.
const CORE_FIELDS =
  'logo_url, whatsapp_number, notification_email, instagram_url, facebook_url, branches, video_360_url'

export async function getStoreData(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ tenant: StoreTenant | null; config: StoreConfig | null }> {
  const [tenantRes, configRes] = await Promise.all([
    supabase.from('tenants').select('name, domain').eq('id', tenantId).single(),
    supabase.from('store_config').select('*').eq('tenant_id', tenantId).single(),
  ])

  if (tenantRes.error) {
    console.error('[getStoreData] tenants query failed:', tenantRes.error.message)
  }

  let config = (configRes.data as StoreConfig) ?? null

  if (configRes.error) {
    console.error(
      "[getStoreData] store_config select('*') failed, retrying with core fields only:",
      configRes.error.message
    )
    const fallback = await supabase
      .from('store_config')
      .select(CORE_FIELDS)
      .eq('tenant_id', tenantId)
      .single()
    if (fallback.error) {
      console.error('[getStoreData] core fields fallback ALSO failed:', fallback.error.message)
    }
    config = (fallback.data as StoreConfig) ?? null
  }

  return {
    tenant: (tenantRes.data as StoreTenant) ?? null,
    config,
  }
}
