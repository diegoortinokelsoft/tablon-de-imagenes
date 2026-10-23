import { describe, expect, it } from 'vitest'
import { isValidTitle, toBoardItem } from './board'

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
