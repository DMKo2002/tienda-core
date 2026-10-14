import { createAnonSupabase, TENANT_ID } from '../lib/supabase-server'
import { cached } from '../lib/ttl-cache'
import { NextResponse } from 'next/server'

export const revalidate = 60 // cache 1 min

type Category = { id: string; name: string; slug: string; parent_id: string | null }

export async function GET() {
  const tenantId = await TENANT_ID()

  // Incidente 2026-10-14: esta ruta se pedia en CADA pagina (la llama el
  // Navbar) y hacia una consulta a Supabase por visita (~9k/dia solo en
  // Yenine). Las categorias son publicas, asi que usa un cliente anon sin
  // cookies, cache en memoria de 60s, y Cache-Control para que el CDN de
  // Vercel (que separa por host/tenant) tambien la sirva sin ejecutar nada.
  let all: Category[] = []
  try {
    all = await cached(`nav-categories:${tenantId}`, 60_000, async () => {
      const { data, error } = await createAnonSupabase()
        .from('categories')
        .select('id, name, slug, parent_id')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('sort_order')
        .abortSignal(AbortSignal.timeout(5_000))
      if (error) throw new Error(error.message)
      return (data ?? []) as Category[]
    })
  } catch (err) {
    console.error('[nav-categories] consulta fallo y no hay valor en cache:', err)
    // Menu vacio por un momento es mejor que un 500 en toda la tienda; no se
    // cachea en el CDN para que se recupere apenas vuelva la base.
    return NextResponse.json([], { headers: { 'Cache-Control': 'no-store' } })
  }

  const tree = all
    .filter(c => !c.parent_id)
    .map(c => ({
      ...c,
      subcategories: all
        .filter(s => s.parent_id === c.id)
        .map(s => ({
          ...s,
          subcategories: all.filter(t => t.parent_id === s.id),
        })),
    }))

  return NextResponse.json(tree, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  })
}
