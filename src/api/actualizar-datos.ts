import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase, createServiceSupabase, TENANT_ID } from '../lib/supabase-server'

// ──────────────────────────────────────────────────────────
//  POST /api/auth/actualizar-datos
//  Body: { nombre, apellido, dni, telefono, email, empresa, cuit,
//          direccion, provincia, localidad }
//
//  Actualiza los datos del customer logueado — página "Mis datos"
//  (@creart/tienda-core/MisDatosPage). Requiere sesión activa; el
//  customer se resuelve por auth_user_id (o por email como fallback,
//  igual que el resto de las páginas de cuenta — cubre customers
//  importados cuyo auth_user_id no haya quedado vinculado todavía).
//
//  El "email" acá es el de contacto/facturación (customers.email), NO
//  el mail disfrazado con el que se hace login en Supabase Auth —
//  cambiarlo no afecta cómo el cliente inicia sesión.
// ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await req.json()
    const { nombre, apellido, dni, telefono, email, empresa, cuit, direccion, provincia, localidad } = body
    if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })

    const service = createServiceSupabase()
    const tenantId = TENANT_ID()

    // Resolver el customer: primero por auth_user_id, luego por email (mismo
    // fallback que /cuenta y RegistroPage — cubre customers importados).
    // OJO: user.email acá es el mail "disfrazado" de Supabase Auth (ver
    // lib/auth-email.ts), NO el mail real del cliente — customers.email
    // siempre guarda el real. Para el fallback por email hay que usar
    // user.user_metadata.real_email (lo graba registro.ts al crear la
    // cuenta), si no este fallback nunca matchea nada.
    const realEmail = (user.user_metadata as any)?.real_email ?? null
    let customerId: string | null = null
    const { data: custById } = await service
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (custById) {
      customerId = custById.id
    } else if (realEmail) {
      const { data: custByEmail } = await service
        .from('customers')
        .select('id')
        .eq('email', realEmail)
        .eq('tenant_id', tenantId)
        .maybeSingle()
      customerId = custByEmail?.id ?? null
    }

    if (!customerId) return NextResponse.json({ error: 'No se encontró tu cuenta de cliente' }, { status: 404 })

    const { error } = await service.from('customers').update({
      full_name: nombre,
      last_name: apellido || null,
      dni: dni || null,
      phone: telefono || null,
      ...(email ? { email: String(email).trim().toLowerCase() } : {}),
      company_name: empresa || null,
      cuit: cuit || null,
      address_street: direccion || null,
      address_province: provincia || null,
      address_city: localidad || null,
      // Vincular auth_user_id acá también, por si el customer se resolvió
      // por email (importado, sin vincular todavía).
      auth_user_id: user.id,
    }).eq('id', customerId).eq('tenant_id', tenantId)

    if (error) {
      console.error('[actualizar-datos] error:', error.message)
      return NextResponse.json({ error: 'No se pudieron guardar los datos. Intentá de nuevo.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Error actualizar-datos:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
