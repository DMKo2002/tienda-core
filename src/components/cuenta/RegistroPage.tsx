import { redirect } from 'next/navigation'
import { createServerSupabase, createServiceSupabase, TENANT_ID } from '../../lib/supabase-server'
import RegistroForm from './RegistroForm'

// Página de alta / upgrade a mayorista, compartida por todos los templates vía
// @creart/tienda-core/RegistroPage. Cada tienda solo hace:
//   export { default } from '@creart/tienda-core/RegistroPage'
export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ upgrade?: string }>
}) {
  const params = await searchParams
  const isUpgrade = params?.upgrade === '1'

  // Alta de cuenta nueva: no requiere sesión, se muestra directo.
  if (!isUpgrade) {
    return <RegistroForm isUpgrade={false} />
  }

  // "Pasate a Mayorista" SIEMPRE requiere sesión iniciada (es un upgrade de la
  // cuenta logueada). Antes esto se chequeaba recién al enviar el formulario,
  // así que alguien sin sesión (o con la sesión vencida) completaba todo el
  // form y recién ahí se encontraba con el cartel rojo "Iniciá sesión...".
  // Ahora se resuelve acá: si no hay sesión, directo a login, sin mostrar el
  // formulario ni ningún mensaje de error.
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/cuenta/login')

  const service = createServiceSupabase()
  const tenantId = TENANT_ID()

  // Mismo fallback que usa /cuenta: primero por auth_user_id, después por
  // email (cubre customers importados cuyo auth_user_id no haya quedado
  // vinculado). Antes esto se resolvía en el navegador buscando SOLO por
  // auth_user_id — si no matcheaba, nombre y apellido quedaban vacíos sin
  // ningún aviso.
  let customer: { full_name?: string | null; last_name?: string | null; email?: string | null } | null = null
  const { data: custById } = await service
    .from('customers')
    .select('full_name, last_name, email')
    .eq('auth_user_id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (custById) {
    customer = custById
  } else if (user.email) {
    const { data: custByEmail } = await service
      .from('customers')
      .select('full_name, last_name, email')
      .eq('email', user.email)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    customer = custByEmail
  }

  return (
    <RegistroForm
      isUpgrade
      initialNombre={customer?.full_name ?? ''}
      initialApellido={customer?.last_name ?? ''}
      initialEmail={customer?.email ?? user.email ?? ''}
    />
  )
}
