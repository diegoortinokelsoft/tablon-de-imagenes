import { describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave')
vi.stubEnv('VITE_ALLOWED_DOMAIN', 'grupokelsoft.com')

const { buildImagePath, chunk } = await import('./storage')

describe('chunk', () => {
  it('parte en lotes de hasta 100', () => {
    const items = Array.from({ length: 250 }, (_, i) => i)
    expect(chunk(items, 100).map((batch) => batch.length)).toEqual([100, 100, 50])
  })

  it('sin elementos no hay lotes', () => {
    expect(chunk([], 100)).toEqual([])
  })
})

describe('buildImagePath', () => {
  it('arma {round_id}/{user_id}/{uuid}.webp', () => {
    expect(buildImagePath('ronda', 'usuario', 'abc')).toBe('ronda/usuario/abc.webp')
  })

  it('genera un nombre nuevo en cada llamada', () => {
    const a = buildImagePath('r', 'u')
    const b = buildImagePath('r', 'u')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^r\/u\/[0-9a-f-]{36}\.webp$/)
  })
})
