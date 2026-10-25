import { describe, expect, it } from 'vitest'
import { activeOwnedCount, filterHub, isActive, normalizeSearch, type HubItem } from './hub'

const item = (overrides: Partial<HubItem>): HubItem => ({
  name: 'Competencia',
  status: 'open',
  owner_id: 'otro',
  last_activity_at: '2026-10-20T00:00:00Z',
  cleaned_at: null,
  my_involvement: false,
  ...overrides,
})

describe('isActive y activeOwnedCount', () => {
  it('cuenta preparadas, abiertas y cerradas propias, sin finalizadas ni archivadas', () => {
    const items = [
      item({ owner_id: 'yo', status: 'pending' }),
      item({ owner_id: 'yo', status: 'closed' }),
      item({ owner_id: 'yo', status: 'finalized' }),
      item({ owner_id: 'yo', status: 'open', cleaned_at: '2026-10-01T00:00:00Z' }),
      item({ owner_id: 'otro', status: 'open' }),
    ]
    expect(activeOwnedCount(items, 'yo')).toBe(2)
    expect(isActive(item({ status: 'finalized' }))).toBe(false)
  })
})

describe('normalizeSearch', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(normalizeSearch('  Música Ñandú ')).toBe('musica nandu')
  })
})

describe('filterHub', () => {
  const items = [
    item({ name: 'Finalizada', status: 'finalized', last_activity_at: '2026-10-22T00:00:00Z' }),
    item({ name: 'Abierta vieja', status: 'open', last_activity_at: '2026-10-01T00:00:00Z' }),
    item({ name: 'Archivada', status: 'finalized', cleaned_at: '2026-10-23T00:00:00Z' }),
    item({ name: 'Preparada', status: 'pending', my_involvement: true }),
    item({ name: 'Abierta nueva', status: 'open', last_activity_at: '2026-10-21T00:00:00Z', my_involvement: true }),
  ]
  const names = (tab: Parameters<typeof filterHub>[1], search = '') =>
    filterHub(items, tab, search).map((round) => round.name)

  it('ordena abiertas primero y, dentro del grupo, por actividad reciente; archivadas al final', () => {
    expect(names('all')).toEqual(['Abierta nueva', 'Abierta vieja', 'Preparada', 'Finalizada', 'Archivada'])
  })

  it('filtra por pestaña', () => {
    expect(names('mine')).toEqual(['Abierta nueva', 'Preparada'])
    expect(names('open')).toEqual(['Abierta nueva', 'Abierta vieja'])
    expect(names('finalized')).toEqual(['Finalizada'])
  })

  it('busca por nombre sin importar tildes', () => {
    expect(names('all', 'ABIERTA')).toEqual(['Abierta nueva', 'Abierta vieja'])
    expect(names('all', 'nada')).toEqual([])
  })
})
