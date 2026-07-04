import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Para client components: lee la cookie x-tenant-id que escribe el middleware
// (funciona en multi-tenant donde el mismo deploy sirve varios dominios).
// Fallback al env var para desarrollo local.
export const TENANT_ID = (): string => {
  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(?:^|;\s*)x-tenant-id=([^;]+)/)
    if (match?.[1]) return match[1]
  }
  return process.env.NEXT_PUBLIC_TENANT_ID ?? ''
}
