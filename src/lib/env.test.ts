import { describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave')
vi.stubEnv('VITE_ALLOWED_DOMAIN', 'grupokelsoft.com')

const { readEnv } = await import('./env')

describe('readEnv', () => {
  it('devuelve las variables normalizadas', () => {
    expect(
      readEnv({
        VITE_SUPABASE_URL: ' https://x.supabase.co ',
        VITE_SUPABASE_ANON_KEY: 'clave',
        VITE_ALLOWED_DOMAIN: 'GrupoKelsoft.com',
      }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'clave', allowedDomain: 'grupokelsoft.com' })
  })

  it('falla indicando qué variables faltan', () => {
    expect(() => readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_ALLOWED_DOMAIN: ' ' })).toThrow(
      'Faltan variables de entorno: VITE_SUPABASE_ANON_KEY, VITE_ALLOWED_DOMAIN',
    )
  })
})
