import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

/**
 * Devuelve el tenant_id del request actual.
 * En producción lo resuelve el middleware desde el dominio (x-tenant-id header).
 * En local cae al env var NEXT_PUBLIC_TENANT_ID.
 */
export function getTenantId(): string {
  try {
    const id = headers().get('x-tenant-id')
    if (id) return id
  } catch {}
  return process.env.NEXT_PUBLIC_TENANT_ID ?? ''
}

// Alias callable — los archivos existentes solo agregan () al usarlo
export const TENANT_ID = getTenantId

/**
 * Cliente con service role key — bypasea RLS completamente.
 * Usar para operaciones sobre customers, users, o cualquier tabla con RLS restrictiva.
 * NUNCA exponer al browser (solo usar en server components / API routes).
 */
export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
