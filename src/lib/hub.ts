import type { RoundStatus } from './labels'

/** Lo que el hub necesita de cada competencia (subconjunto de hub_rounds). */
export interface HubItem {
  name: string
  status: RoundStatus
  owner_id: string
  last_activity_at: string
  cleaned_at: string | null
  my_involvement: boolean
}

export type HubTab = 'mine' | 'open' | 'finalized' | 'all'

export const HUB_TABS: Record<HubTab, string> = {
  mine: 'Mis competencias',
  open: 'Abiertas',
  finalized: 'Finalizadas',
  all: 'Todas',
}

/** Máximo de competencias activas por dueño (el superadmin no tiene límite). */
export const MAX_ACTIVE_ROUNDS = 2

/** Activa: preparada, abierta o cerrada, y sin limpiar. Mismo criterio que create_round. */
export function isActive(item: Pick<HubItem, 'status' | 'cleaned_at'>): boolean {
  return item.status !== 'finalized' && !item.cleaned_at
}

export function activeOwnedCount(items: HubItem[], userId: string | undefined): number {
  return items.filter((item) => item.owner_id === userId && isActive(item)).length
}

/** Minúsculas y sin tildes, para buscar "musica" y encontrar "Música". */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

function inTab(item: HubItem, tab: HubTab): boolean {
  switch (tab) {
    case 'mine':
      return item.my_involvement
    case 'open':
      return item.status === 'open' && !item.cleaned_at
    case 'finalized':
      return item.status === 'finalized' && !item.cleaned_at
    case 'all':
      return true
  }
}

// Abiertas primero, después preparadas, cerradas, finalizadas y, al final, las archivadas.
const GROUP_ORDER: Record<RoundStatus, number> = { open: 0, pending: 1, closed: 2, finalized: 3 }

function group(item: HubItem): number {
  return item.cleaned_at ? 4 : GROUP_ORDER[item.status]
}

/** Filtra por pestaña y búsqueda, y ordena por grupo y, dentro de cada grupo, por actividad más reciente. */
export function filterHub<T extends HubItem>(items: T[], tab: HubTab, search: string): T[] {
  const query = normalizeSearch(search)
  return items
    .filter((item) => inTab(item, tab) && (!query || normalizeSearch(item.name).includes(query)))
    .sort((a, b) => group(a) - group(b) || b.last_activity_at.localeCompare(a.last_activity_at))
}
