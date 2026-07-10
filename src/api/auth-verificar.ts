import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '../lib/supabase-server'

/**
 * Verifica el token de confirmación de email o recuperación de contraseña.
 *
 * El link en el email apunta a:
 *   /auth/verificar?token_hash=TOKEN&type=signup|recovery[&next=/ruta]
 *
 * Usa verifyOtp() con token_hash (server-side) en lugar de depender del
 * action_link de Supabase, que redirige con tokens en el hash URL (#)
 * que los server route handlers no pueden leer.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as 'signup' | 'recovery' | null
  const next = searchParams.get('next') ?? '/cuenta'

  console.log('[auth-verificar] token_hash presente:', !!token_hash, 'type:', type, 'next:', next)

  if (token_hash && (type === 'signup' || type === 'recovery')) {
    try {
      const supabase = await createServerSupabase()
      const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
      console.log('[auth-verificar] verifyOtp result — user:', data?.user?.id ?? 'null', 'error:', error?.message ?? 'none')

      if (!error) {
        if (type === 'signup') {
          // Usuario confirmado y logueado → ir a su cuenta
          return NextResponse.redirect(`${origin}/cuenta`)
        }
        // Recovery → ir a la página para establecer nueva contraseña
        return NextResponse.redirect(`${origin}${next}`)
      }
    } catch (err: any) {
      console.error('[auth-verificar] excepción:', err?.message ?? err)
    }
  }

  // Token inválido, expirado, o parámetros faltantes
  return NextResponse.redirect(`${origin}/cuenta/login?confirmacion=error`)
}
