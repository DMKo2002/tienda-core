import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '../lib/supabase-server'

/**
 * Ruta de callback de Supabase Auth.
 * Supabase redirige aquí después de que el usuario hace click en el link de confirmación de email.
 * Intercambia el code PKCE por una sesión activa y redirige a la cuenta.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/cuenta'

  if (code) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Confirmación exitosa → redirige a la cuenta
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Si hubo error o no hay code → redirige al login con mensaje
  return NextResponse.redirect(`${origin}/cuenta/login?confirmacion=error`)
}
