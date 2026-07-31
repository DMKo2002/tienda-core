import { redirect } from 'next/navigation'
import { createServerSupabase, createServiceSupabase, TENANT_ID } from '../../lib/supabase-server'
import MisDatosForm from './MisDatosForm'

// Página "Mis datos", compartida por todos los templates vía
// @creart/tienda-core/MisDatosPage. Cada tienda solo hace:
//   export { default } from '@creart/tienda-core/MisDatosPage'
export default async function MisDatosPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/cuenta/login')

  const service = createServiceSupabase()
  const tenantId = TENANT_ID()

  // Mismo fallback que /cuenta y RegistroPage: por auth_user_id primero,
  // por email después (cubre customers importados sin vincular todavía).
  // user.email es el mail disfrazado de Auth, no el real — para el fallback
  // usamos user.user_metadata.real_email (grabado por registro.ts).
  const realEmail = (user.user_metadata as any)?.real_email ?? null
  let customer: Record<string, any> | null = null
  const { data: custById } = await service
    .from('customers')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (custById) {
    customer = custById
  } else if (realEmail) {
    const { data: custByEmail } = await service
      .from('customers')
      .select('*')
      .eq('email', realEmail)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    customer = custByEmail
  }

  return (
    <MisDatosForm
      isWholesale={customer?.type === 'wholesale'}
      initial={{
        nombre: customer?.full_name ?? '',
        apellido: customer?.last_name ?? '',
        dni: customer?.dni ?? '',
        telefono: customer?.phone ?? '',
        email: customer?.email ?? realEmail ?? '',
        empresa: customer?.company_name ?? '',
        cuit: customer?.cuit ?? '',
        direccion: customer?.address_street ?? '',
        provincia: customer?.address_province ?? '',
        localidad: customer?.address_city ?? '',
      }}
    />
  )
}
