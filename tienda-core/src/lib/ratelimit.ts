import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Instancia compartida de Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Checkout: máx 5 pedidos por IP cada 60 segundos
export const checkoutLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '60 s'),
  prefix: 'rl:checkout',
})

// Registro: máx 3 intentos por IP cada 10 minutos
export const registroLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '10 m'),
  prefix: 'rl:registro',
})
