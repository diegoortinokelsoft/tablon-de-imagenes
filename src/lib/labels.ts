import type { Database } from './database.types'

export type RoundStatus = Database['public']['Enums']['round_status']

export const STATUS_LABELS: Record<RoundStatus, string> = {
  pending: 'Preparada',
  open: 'Abierta',
  closed: 'Cerrada',
  finalized: 'Finalizada',
  archived: 'Historial',
}

/** Iniciales para el avatar cuando no hay foto: primera letra del primer y último nombre. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0]]
  return letters.filter(Boolean).join('').toUpperCase() || '?'
}
