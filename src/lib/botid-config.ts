// Rutas protegidas por BotID, compartidas entre los 6 templates. Se usa
// tanto en el <BotIdClient/> del layout raiz (le dice al browser que
// requests instrumentar) como documentacion de que protege
// ../api/track-visit.ts. Agregar aca -- no repetir en cada template por
// separado -- cualquier otra ruta de alto valor que se proteja con BotID
// en el futuro (ver plan de testing de facturacion, 2026-08-26).
export const BOTID_PROTECTED_ROUTES = [
  { path: '/api/track-visit', method: 'POST' as const },
]
