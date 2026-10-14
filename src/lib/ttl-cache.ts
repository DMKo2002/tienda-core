// Cache en memoria con TTL para datos publicos y baratos de cambiar
// (resolucion de tenant, config de tienda, categorias).
//
// Por que existe (incidente 2026-10-14): cada visita a una tienda disparaba
// entre 4 y 6 consultas a Supabase (middleware + SSR), todas sin cache. Con el
// trafico de campanas de Meta hacia Yenine Sweaters (~260k requests/dia) la
// base agoto el Disk IO y el middleware empezo a devolver 504 por timeout.
//
// Que hace:
// - Guarda el resultado por `key` durante `ttlMs` dentro de la instancia
//   (isolate del edge / lambda de Node). No es compartido entre instancias,
//   pero alcanza: baja las consultas de "una por visita" a "una cada TTL por
//   instancia".
// - Deduplica pedidos simultaneos: si 200 visitas llegan juntas con el cache
//   vencido, solo UNA consulta sale a la base; el resto espera esa promesa.
// - Si el loader falla (la base esta caida/lenta) y habia un valor vencido,
//   devuelve ese valor viejo en vez de propagar el error ("stale on error").
//
// IMPORTANTE: el `loader` tiene que LANZAR error ante una falla de Supabase
// (supabase-js devuelve { error } sin lanzar). Si devuelve el error como
// valor normal, se cachea la falla.

type Entry<T> = { value: T; expires: number }

const store = new Map<string, Entry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()
const MAX_ENTRIES = 500

export async function cached<T>(
  key: string,
  ttlMs: number | ((value: T) => number),
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expires > now) return hit.value

  const pending = inflight.get(key) as Promise<T> | undefined
  if (pending) return pending

  const promise = (async () => {
    try {
      const value = await loader()
      const ttl = typeof ttlMs === 'function' ? ttlMs(value) : ttlMs
      if (store.size >= MAX_ENTRIES) {
        const oldest = store.keys().next().value
        if (oldest !== undefined) store.delete(oldest)
      }
      store.set(key, { value, expires: Date.now() + ttl })
      return value
    } catch (err) {
      if (hit) {
        console.error(`[ttl-cache] loader fallo para "${key}", sirvo valor vencido:`, err)
        // Reintento recien en 10s para no martillar una base que esta mal.
        store.set(key, { value: hit.value, expires: Date.now() + 10_000 })
        return hit.value
      }
      throw err
    } finally {
      inflight.delete(key)
    }
  })()

  inflight.set(key, promise)
  return promise
}
