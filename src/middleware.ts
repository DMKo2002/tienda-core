import { NextRequest, NextResponse, NextFetchEvent } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const requestHeaders = new Headers(req.headers)

  // 1. Refresco de sesion Supabase
  let response = NextResponse.next({ request: { headers: requestHeaders } })

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
  await supabaseAuth.auth.getUser()

  // 2. Resolucion de tenant
  const hostname = req.headers.get('host') ?? ''
  const host = hostname.replace(/^www\./, '').split(':')[0]

  const isLocal =
    host === 'localhost' ||
    host.startsWith('127.') ||
    host.startsWith('192.168.')

  let tenantId: string | null = null

  if (!isLocal) {
    const supabaseTenant = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    if (host.endsWith('.gounuri.com')) {
      const slug = host.replace(/\.gounuri\.com$/, '')
      if (slug) {
        const { data } = await supabaseTenant
          .from('tenants')
          .select('id, domain')
          .eq('slug', slug)
          .eq('status', 'active')
          .maybeSingle()

        // Si el tenant ya cargo su dominio propio, el subdominio .gounuri.com
        // deja de servir la tienda en paralelo (contenido duplicado para
        // Google: la misma tienda en dos URLs vivas) y redirige al dominio
        // real. Se excluyen las rutas /api/ porque ahi pueden pegar webhooks
        // externos (ej. pasarela de pago) que no toleran un redirect. Si el
        // tenant todavia no tiene dominio propio, el subdominio sigue siendo
        // su frontend normal, sin ningun cambio.
        if (data?.domain && !req.nextUrl.pathname.startsWith('/api/')) {
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
      const { data } = await supabaseTenant
        .from('tenants')
        .select('id')
        .eq('domain', host)
        .eq('status', 'active')
        .maybeSingle()
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