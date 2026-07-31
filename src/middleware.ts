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
          .select('id')
          .eq('slug', slug)
          .eq('status', 'active')
          .maybeSingle()
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

  // 3. Medición de visitas del mes (límite del plan — ver Panel Admin
  //    /dashboard/uso). Solo pageviews reales: GET de páginas, sin /api,
  //    sin assets (path con extensión) y sin prefetch del router.
  //    Fire-and-forget via waitUntil — nunca frena la respuesta.
  const path = req.nextUrl.pathname
  const esPageview =
    !!tenantId &&
    req.method === 'GET' &&
    !path.startsWith('/api') &&
    !path.includes('.') &&
    req.headers.get('purpose') !== 'prefetch' &&
    !req.headers.get('next-router-prefetch')

  if (esPageview) {
    event.waitUntil(
      fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/record_visit`, {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tid: tenantId }),
      }).catch(() => {})
    )
  }

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
