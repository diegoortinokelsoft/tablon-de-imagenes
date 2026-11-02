import type { RoundStatus } from './labels'

// Consultas de una competencia que se vuelven a leer ante cualquier cambio en ella.
export const ROUND_QUERY_KEYS = [
  'round',
  'board',
  'vote_details',
  'my_votes',
  'round_stats',
  'round_access',
  'round_members',
  'access_requests',
  'invite_token',
] as const

// Consultas del hub, que se vuelven a leer ante cambios en competencias, miembros o solicitudes.
export const HUB_QUERY_KEYS = ['hub'] as const

export const REALTIME_DEBOUNCE_MS = 300

/** Aviso al cambiar el estado de la competencia que se está mirando (null si no hay que avisar). */
export function statusChangeMessage(previous: RoundStatus | null, next: RoundStatus | null): string | null {
  if (!previous || !next || previous === next) return null
  if (next === 'closed' && previous === 'open') return 'La votación se cerró'
  if (next === 'open' && previous === 'closed') return 'La votación se reabrió'
  if (next === 'open') return '¡La competencia abrió!'
  if (next === 'finalized') return '¡Ya hay ganador!'
  if (next === 'closed') return 'La competencia volvió a la etapa de ranking'
  return null
}

/** Agrupa llamadas en ráfaga: ejecuta fn una sola vez, ms después de la última. */
export function debounce(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = () => {
    clearTimeout(timer)
    timer = setTimeout(fn, ms)
  }
  run.cancel = () => clearTimeout(timer)
  return run
}
