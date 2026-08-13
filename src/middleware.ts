import { NextRequest, NextResponse, NextFetchEvent } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Bots/crawlers/monitores conocidos que NO deben contar como "visita" para
// el medidor de plan (tenant_visits). Cubre buscadores, crawlers de IA,
// previews de redes sociales/mensajería, SEO tools, y monitores de uptime.
// Ver: alerta de Vercel del 2026-08-10 (facebookexternalhit) + auditoría de
// superadmin del 2026-08-13 (Yenine Sweaters: 298.742 visitas / 7 pedidos).
const BOT_UA_REGEX =
  /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp|telegram|discordbot|slackbot|twitterbot|linkedinbot|pinterest|redditbot|applebot|googlebot|bingbot|duckduckbot|yandexbot|baiduspider|gptbot|chatgpt-user|oai-searchbot|ccbot|claudebot|anthropic-ai|perplexitybot|bytespider|ahrefsbot|semrushbot|mj12bot|dotbot|screaming\s*frog|uptimerobot|pingdom|statuscake|better\s*uptime|site24x7|headlesschrome|phantomjs|puppeteer|playwright|curl\/|wget\/|python-requests|node-fetch|go-http-client|okhttp|axios\/|postmanruntime|insomnia/i

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
  //    sin assets (path con extensión), sin prefetch del router, y sin
  //    bots/crawlers/monitores conocidos (ver BOT_UA_REGEX arriba — esta
  //    métrica determina el cupo de plan del tenant, no debe inflarse con
  //    tráfico no-humano).
  //    Fire-and-forget via waitUntil — nunca frena la respuesta.
  const path = req.nextUrl.pathname
  const userAgent = req.headers.get('user-agent') ?? ''
  const esBot = userAgent === '' || BOT_UA_REGEX.test(userAgent)

  const esPageview =
    !!tenantId &&
    req.method === 'GET' &&
    !path.startsWith('/api') &&
    !path.includes('.') &&
    req.headers.get('purpose') !== 'prefetch' &&
    !req.headers.get('next-router-prefetch') &&
    !esBot

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