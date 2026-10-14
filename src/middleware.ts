import { NextRequest, NextResponse, NextFetchEvent } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cached } from './lib/ttl-cache'

// Página estática mínima para un tenant que existe pero no está activo
// (suspendido por falta de pago, límite excedido, o a mano desde
// Superadmin). A propósito no depende de datos del tenant (nombre/logo) para
// no agregar un segundo query acá -- si se quiere algo con marca propia por
// tienda, ver nota de David del 2026-08-31 y ampliarlo sin tocar la lógica
// de resolución de arriba.
const SUSPENDED_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Tienda no disponible</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #fafafa; color: #18181b;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .box { max-width: 420px; text-align: center; }
  h1 { font-size: 1.25rem; margin-bottom: 8px; }
  p { color: #71717a; line-height: 1.5; }
</style></head>
<body><div class="box">
  <h1>Esta tienda no está disponible en este momento</h1>
  <p>El dueño de esta tienda todavía puede acceder a su cuenta y a todos sus datos. Si buscabas comprar algo acá, contactate directo con la tienda para más información.</p>
</div></body></html>`

// Respuesta cuando no se pudo resolver el tenant porque la base no contesta.
// 503 + no-store: el visitante reintenta en segundos y el CDN no la cachea.
// Antes, en este caso el middleware quedaba colgado hasta los 25s de Vercel
// (504 MIDDLEWARE_INVOCATION_TIMEOUT), o peor, un error de la consulta se
// leia como "no existe el tenant" y se servia el catalogo de la tienda demo.
const UNAVAILABLE_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="5">
<title>Un momento</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; background: #fafafa; color: #18181b;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .box { max-width: 420px; text-align: center; }
  h1 { font-size: 1.25rem; margin-bottom: 8px; }
  p { color: #71717a; line-height: 1.5; }
</style></head>
<body><div class="box">
  <h1>Estamos cargando la tienda</h1>
  <p>Hay mucha gente conectada en este momento. Esta página se vuelve a intentar sola en unos segundos.</p>
</div></body></html>`

type TenantRow = {
  id: string
  status: string
  domain: string | null
  domain_status: string | null
}

// Resolucion de tenant con cache en memoria (60s si existe, 15s si no existe
// para que un tenant recien creado aparezca rapido). Antes esta consulta
// corria en CADA request (~130k/dia solo desde el middleware).
// Lanza si la base falla y no hay valor previo; el caller responde 503.
// Efecto a tener en cuenta: un cambio de status (suspension) o de dominio
// tarda hasta 60s en aplicarse.
async function findTenant(column: 'slug' | 'domain', value: string): Promise<TenantRow | null> {
  return cached<TenantRow | null>(
    `mw-tenant:${column}:${value}`,
    (row) => (row ? 60_000 : 15_000),
    async () => {
      const supabaseTenant = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => [], setAll: () => {} } }
      )
      const { data, error } = await supabaseTenant
        .from('tenants')
        .select('id, status, domain, domain_status')
        .eq(column, value)
        .abortSignal(AbortSignal.timeout(3_000))
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data as TenantRow | null) ?? null
    }
  )
}

function tenantLookupUnavailable(err: unknown): NextResponse {
  console.error('[middleware] no se pudo resolver el tenant:', err)
  return new NextResponse(UNAVAILABLE_HTML, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'retry-after': '5',
      'cache-control': 'no-store',
    },
  })
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const requestHeaders = new Headers(req.headers)

  // 1. Refresco de sesion Supabase
  let response = NextResponse.next({ request: { headers: requestHeaders } })

  // Solo si el visitante trae cookie de sesion de Supabase. Los visitantes
  // anonimos (casi todo el trafico de campanas) no tienen nada que refrescar,
  // y auth.getUser() es una llamada de red a /auth/v1/user en cada request.
  // Tambien con tope de 3s: si Auth no contesta, se sigue sin refrescar.
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'))

  if (hasSession) {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value }) =>
              requestHeaders.set('cookie', `${name}=${value}`)
            )
            response = NextResponse.next({ request: { headers: requestHeaders } })
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )
    try {
      await Promise.race([
        supabaseAuth.auth.getUser(),
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ])
    } catch (err) {
      console.error('[middleware] refresco de sesion fallo, sigo sin refrescar:', err)
    }
  }

  // 2. Resolucion de tenant
  const hostname = req.headers.get('host') ?? ''
  const host = hostname.replace(/^www\./, '').split(':')[0]

  const isLocal =
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('192.168.')

  let tenantId: string | null = null

  if (!isLocal) {
    if (host.endsWith('.gounuri.com')) {
      const slug = host.replace(/\.gounuri\.com$/, '')
      if (slug) {
        // OJO (2026-08-31, bug real reportado por David en QA): antes este
        // select ya filtraba por status='active', así que un tenant
        // suspendido nunca "existía" para el middleware -- tenantId quedaba
        // null y caía en el fallback de NEXT_PUBLIC_TENANT_ID de más abajo,
        // que es el tenant DEMO del template (ej. minimalista). Resultado:
        // la URL del tenant suspendido (ej. {slug}.gounuri.com) mostraba el
        // catálogo de OTRA tienda (la demo) en vez de avisar que está
        // suspendida. Ahora se trae el tenant SIN filtrar por status, para
        // poder distinguir "no existe ningún tenant con este slug" (sigue
        // cayendo al fallback de demo, sirve para previews) de "existe pero
        // no está activo" (corta acá mismo con un aviso, nunca sigue de
        // largo hacia el fallback de demo).
        let data: TenantRow | null = null
        try {
          data = await findTenant('slug', slug)
        } catch (err) {
          return tenantLookupUnavailable(err)
        }

        if (data && data.status !== 'active' && !req.nextUrl.pathname.startsWith('/api/')) {
          return new NextResponse(SUSPENDED_HTML, {
            status: 503,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        }

        // Si el tenant ya cargo su dominio propio Y ese dominio esta
        // verificado (DNS delegado y funcionando), el subdominio
        // .gounuri.com deja de servir la tienda en paralelo (contenido
        // duplicado para Google: la misma tienda en dos URLs vivas) y
        // redirige al dominio real. Dos guardas importantes:
        // - domain_status !== 'verified' (ej. 'pending', DNS todavia no
        //   delegado) NO redirige -- si no, se manda al visitante a un
        //   dominio que todavia no responde y se rompe la unica direccion
        //   que le funcionaba.
        // - data.domain !== host evita el bucle infinito de los tenants
        //   demo (atelier, axis, bazaar, glow, minimalista, mono), que
        //   tienen su propio *.gounuri.com cargado como "domain".
        // Se excluyen ademas las rutas /api/ porque ahi pueden pegar
        // webhooks externos (ej. pasarela de pago) que no toleran un
        // redirect. Si el tenant todavia no tiene dominio propio
        // verificado, el subdominio sigue siendo su frontend normal, sin
        // ningun cambio.
        if (
          data?.domain &&
          data.domain !== host &&
          data.domain_status === 'verified' &&
          !req.nextUrl.pathname.startsWith('/api/')
        ) {
          const redirectUrl = req.nextUrl.clone()
          redirectUrl.protocol = 'https:'
          redirectUrl.host = data.domain
          redirectUrl.port = ''
          const redirectResponse = NextResponse.redirect(redirectUrl, 302)
          response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie))
          return redirectResponse
        }

        tenantId = data?.id ?? null
      }
    } else {
      let data: TenantRow | null = null
      try {
        data = await findTenant('domain', host)
      } catch (err) {
        return tenantLookupUnavailable(err)
      }
      if (data && data.status !== 'active' && !req.nextUrl.pathname.startsWith('/api/')) {
        return new NextResponse(SUSPENDED_HTML, {
          status: 503,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }
      tenantId = data?.id ?? null
    }
  }

  if (!tenantId) {
    tenantId = process.env.NEXT_PUBLIC_TENANT_ID ?? null
  }

  // Medicion de visitas del mes (limite del plan) -- se movio a un flujo
  // client-triggered protegido por BotID, ver src/api/track-visit.ts y
  // src/components/analytics/VisitTracker.tsx. El filtro por User-Agent que
  // vivia aca era facil de esquivar con cualquier script que mandara un UA
  // de browser normal (ver auditoria 2026-08-26: Yenine Sweaters tenia
  // 880.823 "visitas" / 21 pedidos en el mes).

  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId)
    response.cookies.set('x-tenant-id', tenantId, {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}