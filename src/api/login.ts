import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, TENANT_ID } from '../lib/supabase-server'
import { syntheticAuthEmail } from '../lib/auth-email'

// ──────────────────────────────────────────────────────────
//  POST /api/auth/login
//  Body: { email, password }
//
//  Login pasa por acá (server-side) en vez de llamar
//  supabase.auth.signInWithPassword directo desde el browser porque
//  necesitamos calcular el mail "disfrazado" por tienda (ver
//  lib/auth-email.ts) antes de autenticar — y ese cálculo necesita
//  saber el tenant actual, que solo está disponible server-side
//  (header x-tenant-id que pone el middleware).
//
//  Probamos primero con el mail disfrazado (cuentas registradas
//  después de la migración a mail disfrazado). Si falla, probamos
//  con el mail real tal cual (cuentas viejas, de antes del cambio,
//  que quedan sin tocar).
// ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body
    if (!email || !password) {
      return NextResponse.json({ error: 'Faltan email o contraseña' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const tenantId = TENANT_ID()
    const normalizedEmail = String(email).trim().toLowerCase()
    const syntheticEmail = syntheticAuthEmail(tenantId, normalizedEmail)

    let { error } = await supabase.auth.signInWithPassword({ email: syntheticEmail, password })

    if (error) {
      // Fallback: cuenta vieja (de antes del mail disfrazado) que usa el mail real tal cual
      const retry = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      error = retry.error
    }

    if (error) {
      const msg = error.message ?? ''
      if (msg.includes('Invalid login') || msg.toLowerCase().includes('invalid')) {
        return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
      }
      if (msg.includes('Email not confirmed')) {
        return NextResponse.json({ error: 'Confirmá tu email antes de iniciar sesión. Revisá tu bandeja de entrada.' }, { status: 401 })
      }
      return NextResponse.json({ error: msg }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Error login:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
