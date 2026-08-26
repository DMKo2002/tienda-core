// Registra una visita real (no bot) para el medidor de plan (tenant_visits).
// Se llama desde el cliente (ver ../components/analytics/VisitTracker.tsx),
// una vez por carga de pagina, protegido por BotID (ver ../lib/botid-config.ts
// y el <BotIdClient/> montado en el layout raiz de cada template).
//
// Reemplaza el conteo que antes hacia middleware.ts en cada request server-side,
// filtrando por una lista de User-Agents de bots conocidos -- cualquier script
// que mandara un UA de browser normal la esquivaba sin problema. BotID hace
// deteccion real (Basic, gratis en todos los planes) en vez de una lista negra
// de strings. Ver auditoria 2026-08-26: Yenine Sweaters tenia 880.823
// "visitas" / 21 pedidos en el mes.
import { checkBotId } from 'botid/server'
import { NextRequest, NextResponse } from 'next/server'
import { getTenantId, createServiceSupabase } from '../lib/supabase-server'

export async function POST(_request: NextRequest) {
  const verification = await checkBotId()

  // No es un error -- un bot simplemente no cuenta como visita. Nunca
  // devolvemos 403 ni logueamos nada distinto, para no darle senal al bot
  // de que fue detectado (y porque esto no es una accion sensible que haya
  // que bloquear, solo una metrica que no hay que inflar).
  if (verification.isBot) {
    return NextResponse.json({ ok: true })
  }

  const tenantId = getTenantId()
  if (!tenantId) {
    return NextResponse.json({ ok: true })
  }

  try {
    const supabase = createServiceSupabase()
    await supabase.rpc('record_visit', { tid: tenantId })
  } catch {
    // fire-and-forget -- un fallo aca nunca debe afectar la respuesta al cliente
  }

  return NextResponse.json({ ok: true })
}
