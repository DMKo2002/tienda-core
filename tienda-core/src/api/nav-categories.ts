import { createServerSupabase, TENANT_ID } from '../lib/supabase-server'
import { NextResponse } from 'next/server'

export const revalidate = 60 // cache 1 min

export async function GET() {
  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .eq('tenant_id', TENANT_ID())
    .eq('active', true)
    .order('sort_order')

  const all = data ?? []
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

  return NextResponse.json(tree)
}
