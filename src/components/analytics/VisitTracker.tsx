'use client'

// Dispara UNA vez por carga de pagina (no por cada navegacion client-side --
// este componente vive en el layout raiz, que no se remonta al navegar
// dentro del mismo template) el registro de visita real para el medidor de
// plan del tenant. Reemplaza el conteo que antes hacia middleware.ts
// server-side en cada request -- ver ../../api/track-visit.ts y
// ../../lib/botid-config.ts.
//
// BotID corre en el browser antes de este fetch (ver <BotIdClient/> montado
// en el <head> del layout raiz de cada template) y agrega las cabeceras que
// track-visit.ts necesita para poder distinguir un browser real de un
// script/bot -- sin eso, checkBotId() del lado del server no tiene nada que
// verificar.
//
// Uso en cada template:
//   // src/app/layout.tsx
//   import VisitTracker from '@creart/tienda-core/VisitTracker'
//   ...
//   <body>
//     {children}
//     <VisitTracker />
//   </body>
import { useEffect } from 'react'

export default function VisitTracker() {
  useEffect(() => {
    fetch('/api/track-visit', { method: 'POST', keepalive: true }).catch(() => {})
  }, [])

  return null
}
