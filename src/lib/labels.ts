import type { Database } from './database.types'

export type RoundStatus = Database['public']['Enums']['round_status']

export const STATUS_LABELS: Record<RoundStatus, string> = {
  pending: 'Preparada',
  open: 'Abierta',
  closed: 'Cerrada',
  finalized: 'Finalizada',
  archived: 'Historial',
}

/** Sugiere el nombre de la próxima competencia: "Competencia 1" → "Competencia 2". */
export function suggestNextRoundName(current: string | undefined): string {
  const match = current?.trim().match(/^(.*?)(\d+)$/)
  if (!match) return 'Nueva competencia'
  return `${match[1]}${Number(match[2]) + 1}`
}

const dateFormat = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' })

export function formatDate(iso: string | null | undefined): string {
  return iso ? dateFormat.format(new Date(iso)) : ''
}

/** Iniciales para el avatar cuando no hay foto: primera letra del primer y último nombre. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0]]
  return letters.filter(Boolean).join('').toUpperCase() || '?'
}
