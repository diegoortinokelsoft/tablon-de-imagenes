import type { Database } from './database.types'

export type RoundStatus = Database['public']['Enums']['round_status']
export type RoundVisibility = Database['public']['Enums']['round_visibility']

export const STATUS_LABELS: Record<RoundStatus, string> = {
  pending: 'Preparada',
  open: 'Abierta',
  closed: 'Cerrada',
  finalized: 'Finalizada',
}

export const VISIBILITY_LABELS: Record<RoundVisibility, string> = {
  public: 'Pública',
  private: 'Privada',
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
