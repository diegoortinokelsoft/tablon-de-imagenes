import { describe, expect, it } from 'vitest'
import { isValidTitle, rankItems, sortItems, summarizeMyVotes, tiedPositions, toBoardItem, type BoardItem } from './board'

const ranked = (id: string, position: number, createdAt = '2026-10-01') => ({ id, position, createdAt }) as BoardItem

describe('rankItems', () => {
  it('ordena por posición y, a igualdad, por la más antigua', () => {
    const items = [ranked('c', 3), ranked('b', 1, '2026-10-02'), ranked('a', 1, '2026-10-01')]
    expect(rankItems(items).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('tiedPositions', () => {
  it('detecta las posiciones compartidas', () => {
    expect(tiedPositions([ranked('a', 1), ranked('b', 1), ranked('c', 3)])).toEqual(new Set([1]))
  })

  it('sin empates devuelve un conjunto vacío', () => {
    expect(tiedPositions([ranked('a', 1), ranked('b', 2)]).size).toBe(0)
  })
})

const item = (id: string, voteCount: number, createdAt: string) => ({ id, voteCount, createdAt }) as BoardItem

describe('sortItems', () => {
  const items = [item('a', 1, '2026-10-01'), item('b', 3, '2026-10-02'), item('c', 1, '2026-10-03')]

  it('ordena por más recientes', () => {
    expect(sortItems(items, 'recent').map((i) => i.id)).toEqual(['c', 'b', 'a'])
  })

  it('ordena por más votadas y desempata por la más reciente', () => {
    expect(sortItems(items, 'votes').map((i) => i.id)).toEqual(['b', 'c', 'a'])
  })

  it('no modifica la lista original', () => {
    sortItems(items, 'votes')
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('summarizeMyVotes', () => {
  it('cuenta votos por publicación y los que quedan', () => {
    expect(summarizeMyVotes(['x', 'x', 'y'])).toEqual({ bySubmission: { x: 2, y: 1 }, used: 3, left: 0 })
  })

  it('sin votos quedan 3', () => {
    expect(summarizeMyVotes([])).toEqual({ bySubmission: {}, used: 0, left: 3 })
  })
})

describe('isValidTitle', () => {
  it('acepta de 1 a 80 caracteres', () => {
    expect(isValidTitle('a')).toBe(true)
    expect(isValidTitle('a'.repeat(80))).toBe(true)
    expect(isValidTitle('  hola  ')).toBe(true)
  })

  it('rechaza vacíos y de más de 80', () => {
    expect(isValidTitle('')).toBe(false)
    expect(isValidTitle('    ')).toBe(false)
    expect(isValidTitle('a'.repeat(81))).toBe(false)
  })
})

describe('toBoardItem', () => {
  it('normaliza los campos opcionales de la vista', () => {
    const item = toBoardItem({
      id: 's1',
      round_id: 'r1',
      user_id: 'u1',
      title: 'Hola',
      image_path: 'r1/u1/x.webp',
      width: 100,
      height: null,
      created_at: '2026-10-23',
      updated_at: '2026-10-23',
      author_name: null,
      author_avatar: null,
      vote_count: null,
      position: 1,
    })
    expect(item).toMatchObject({ id: 's1', authorName: '', voteCount: 0, position: 1, height: null })
  })
})
