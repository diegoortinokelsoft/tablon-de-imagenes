import { describe, expect, it, vi } from 'vitest'
import type { BoardItem } from './board'

vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave')
vi.stubEnv('VITE_ALLOWED_DOMAIN', 'grupokelsoft.com')

const { buildResultsCsv, csvField, exportFilename, imageEntryName } = await import('./exportZip')

const item = (id: string, position: number, voteCount: number, overrides: Partial<BoardItem> = {}): BoardItem => ({
  id,
  roundId: 'r',
  userId: `u-${id}`,
  title: `Título ${id}`,
  imagePath: `${id}.webp`,
  width: null,
  height: null,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '',
  authorName: `Autor ${id}`,
  authorAvatar: null,
  voteCount,
  position,
  ...overrides,
})

describe('csvField', () => {
  it('deja los valores simples y escapa comas, comillas y saltos', () => {
    expect(csvField('Hola')).toBe('Hola')
    expect(csvField(3)).toBe('3')
    expect(csvField('Uno, dos')).toBe('"Uno, dos"')
    expect(csvField('Dijo "hola"')).toBe('"Dijo ""hola"""')
    expect(csvField('a\nb')).toBe('"a\nb"')
  })
})

describe('buildResultsCsv', () => {
  it('arma el ranking con BOM, encabezado y ganadora', () => {
    const csv = buildResultsCsv([item('b', 2, 1), item('a', 1, 4, { title: 'Con, coma' })], 'b', { 'u-a': 'a@grupokelsoft.com' })
    const lines = csv.split('\r\n')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(lines[0]).toBe('﻿Posición,Título,Autor,Email,Votos,Ganadora,Publicada')
    expect(lines[1]).toBe('1,"Con, coma",Autor a,a@grupokelsoft.com,4,No,2026-10-01T00:00:00Z')
    expect(lines[2]).toBe('2,Título b,Autor b,,1,Sí,2026-10-01T00:00:00Z')
  })
})

describe('imageEntryName', () => {
  it('usa posición, autor y título, sin repetir nombres', () => {
    const used = new Set<string>()
    const a = item('a', 1, 3, { authorName: 'Ana Núñez', title: '¡Mi gato!' })
    expect(imageEntryName(a, used)).toBe('imagenes/01-ana-nunez-mi-gato.webp')
    expect(imageEntryName(a, used)).toBe('imagenes/01-ana-nunez-mi-gato-2.webp')
  })
})

describe('exportFilename', () => {
  it('usa el nombre de la competencia y la fecha', () => {
    expect(exportFilename('Mejor fondo', new Date('2026-12-24T10:00:00Z'))).toBe('mejor-fondo-2026-12-24.zip')
  })
})
