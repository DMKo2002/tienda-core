/**
 * Mail "disfrazado" para Supabase Auth.
 *
 * Problema que resuelve: Supabase Auth es UN SOLO pool de usuarios compartido
 * por toda la plataforma (todas las tiendas Gounuri usan el mismo proyecto de
 * Supabase). Si dos tiendas distintas registran un customer con el mismo email
 * real, Supabase los trataría como la MISMA persona/cuenta — lo cual generaba
 * el bug de "ya existe una cuenta con este email" al registrarse en una segunda
 * tienda, y además significa compartir la misma contraseña entre tiendas que
 * no tienen relación entre sí (poco profesional: Mykonos y Yenine son negocios
 * distintos, no debería alcanzar con una contraseña para las dos).
 *
 * Solución: en vez de mandarle a Supabase Auth el email real que escribe el
 * cliente, le mandamos una versión "disfrazada" que incluye el tenant, así
 * cada tienda tiene su propia cuenta de Auth completamente independiente
 * (propia contraseña, propio estado de confirmación) aunque el cliente use
 * el mismo mail real en todas. El cliente nunca ve ni se entera de esto — el
 * mail real de contacto se guarda tal cual en customers.email, y todos los
 * mails que le mandamos (bienvenida, confirmación, recuperar contraseña,
 * pedidos) van siempre a esa dirección real.
 *
 * auth_user_id (columna en customers) sigue siendo el id de esta cuenta de
 * Auth disfrazada — es válido y único, solo que ya no es una identidad
 * compartida entre tiendas como antes.
 */
export function syntheticAuthEmail(tenantId: string, realEmail: string): string {
  const normalized = realEmail.trim().toLowerCase()
  return `${tenantId}+${normalized.replace('@', '_at_')}@auth.internal.gounuri.com`
}
