import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
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

    if (host.endsWith('.creart.com')) {
      const slug = host.replace(/\.creart\.com$/, '')
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
