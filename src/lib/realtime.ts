import type { RoundStatus } from './labels'

// Consultas que se vuelven a leer ante cualquier cambio en rounds, submissions o votes.
export const REALTIME_QUERY_KEYS = ['board', 'vote_details', 'current_round', 'my_votes', 'history'] as const

export const REALTIME_DEBOUNCE_MS = 300

/** Aviso al cambiar el estado de la competencia actual (null si no hay que avisar). */
export function statusChangeMessage(
  previous: { id: string; status: RoundStatus } | null,
  next: { id: string; status: RoundStatus } | null,
): string | null {
  if (!previous || !next) return null
  if (previous.id !== next.id) return 'Empezó una nueva competencia'
  if (previous.status === next.status) return null
  if (next.status === 'closed' && previous.status === 'open') return 'La votación se cerró'
  if (next.status === 'open' && previous.status === 'closed') return 'La votación se reabrió'
  if (next.status === 'open') return '¡La competencia abrió!'
  if (next.status === 'finalized') return '¡Ya hay ganador!'
  if (next.status === 'closed') return 'La competencia volvió a la etapa de ranking'
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
