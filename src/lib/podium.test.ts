import { describe, expect, it } from 'vitest'
import type { BoardItem } from './board'
import { buildPodium, ordinal, votesLabel } from './podium'

let seq = 0
const item = (id: string, voteCount: number): BoardItem => ({
  id,
  roundId: 'r',
  userId: `u-${id}`,
  title: `Título ${id}`,
  imagePath: `${id}.webp`,
  width: null,
  height: null,
  createdAt: `2026-10-0${++seq}T00:00:00Z`,
  updatedAt: '',
  authorName: id,
  authorAvatar: null,
  voteCount,
  position: 0,
})

const summary = (podium: ReturnType<typeof buildPodium>) =>
  podium && {
    winner: podium.winner.id,
    rest: podium.rest.map((entry) => `${ordinal(entry.place)} ${entry.item.id}`),
    more: podium.more,
  }

describe('buildPodium', () => {
  it('ganador más los dos siguientes por votos', () => {
    const items = [item('a', 5), item('b', 3), item('c', 2), item('d', 1)]
    expect(summary(buildPodium(items, 'a'))).toEqual({ winner: 'a', rest: ['2.º b', '3.º c'], more: 0 })
  })

  it('si el ganador elegido no es el más votado, salen los dos más votados restantes', () => {
    const items = [item('a', 5), item('b', 3), item('c', 2)]
    expect(summary(buildPodium(items, 'c'))).toEqual({ winner: 'c', rest: ['2.º a', '3.º b'], more: 0 })
  })

  it('incluye a los empatados en el último lugar mostrado', () => {
    const items = [item('a', 5), item('b', 3), item('c', 2), item('d', 2)]
    expect(summary(buildPodium(items, 'a'))).toEqual({ winner: 'a', rest: ['2.º b', '3.º c', '3.º d'], more: 0 })
  })

  it('con más de tres empatados muestra tres y cuenta el resto', () => {
    const items = [item('a', 5), item('b', 1), item('c', 1), item('d', 1), item('e', 1), item('f', 1)]
    expect(summary(buildPodium(items, 'a'))).toEqual({ winner: 'a', rest: ['2.º b', '2.º c', '2.º d'], more: 2 })
  })

  it('con menos de tres publicaciones muestra las que hay', () => {
    expect(summary(buildPodium([item('a', 1), item('b', 0)], 'a'))).toEqual({ winner: 'a', rest: ['2.º b'], more: 0 })
    expect(summary(buildPodium([item('a', 1)], 'a'))).toEqual({ winner: 'a', rest: [], more: 0 })
  })

  it('sin ganador devuelve null', () => {
    expect(buildPodium([item('a', 1)], null)).toBeNull()
    expect(buildPodium([item('a', 1)], 'otro')).toBeNull()
  })
})

describe('votesLabel', () => {
  it('usa singular y plural', () => {
    expect(votesLabel(1)).toBe('1 voto')
    expect(votesLabel(0)).toBe('0 votos')
  })
})
