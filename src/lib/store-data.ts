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
  if (configRes.error) {
    console.error('[getStoreData] store_config query failed:', configRes.error.message)
  }

  return {
    tenant: (tenantRes.data as StoreTenant) ?? null,
    config: (configRes.data as StoreConfig) ?? null,
  }
}
