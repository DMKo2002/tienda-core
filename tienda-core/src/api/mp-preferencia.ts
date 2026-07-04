import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createServerSupabase, TENANT_ID } from '../lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { items, payer, order_id } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Items requeridos' }, { status: 400 })
    }

    // Obtener access token del tenant desde store_config
    const supabase = await createServerSupabase()
    const { data: config } = await supabase
      .from('store_config')
      .select('mp_access_token, mp_enabled')
      .eq('tenant_id', TENANT_ID())
      .single()

    if (!config?.mp_enabled) {
      return NextResponse.json({ error: 'MercadoPago no está habilitado' }, { status: 400 })
    }

    const accessToken = config?.mp_access_token
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Configurá tu Access Token de MercadoPago en Panel Admin → Mi tienda → Medios de pago' },
        { status: 400 }
      )
    }

    const client = new MercadoPagoConfig({ accessToken })
    const preference = new Preference(client)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const isProduction = baseUrl.startsWith('https')

    const result = await preference.create({
      body: {
        items: items.map((item: any) => ({
          id: item.variant_id ?? item.id,
          title: item.name,
          description: item.variant_desc ?? '',
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          currency_id: 'ARS',
        })),
        payer: payer ? {
          name: payer.name,
          email: payer.email,
          phone: payer.phone ? { number: payer.phone } : undefined,
        } : undefined,
        ...(isProduction && {
          back_urls: {
            success: `${baseUrl}/checkout/exito?order_id=${order_id}`,
            failure: `${baseUrl}/checkout/error?order_id=${order_id}`,
            pending: `${baseUrl}/checkout/pendiente?order_id=${order_id}`,
          },
          auto_return: 'approved' as const,
        }),
        external_reference: order_id,
        statement_descriptor: 'Tienda Online',
      },
    })

    return NextResponse.json({
      preference_id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point,
    })

  } catch (error: any) {
    console.error('Error MP:', error)
    return NextResponse.json({ error: error.message ?? 'Error interno' }, { status: 500 })
  }
}
