import { describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'clave')
vi.stubEnv('VITE_ALLOWED_DOMAIN', 'grupokelsoft.com')

const { DOMAIN_ERROR_MESSAGE, authErrorMessage, isAllowedEmail, readAuthErrorFromUrl } = await import('./auth')

describe('authErrorMessage', () => {
  it('reconoce el rechazo del hook y del trigger de dominio', () => {
    expect(authErrorMessage('Solo pueden ingresar cuentas @grupokelsoft.com')).toBe(DOMAIN_ERROR_MESSAGE)
    expect(authErrorMessage('Database error saving new user')).toBe(DOMAIN_ERROR_MESSAGE)
  })

  it('usa un mensaje genérico para otros errores', () => {
    expect(authErrorMessage('access_denied')).toBe('No se pudo iniciar sesión. Intenta de nuevo.')
  })
})

describe('isAllowedEmail', () => {
  it('acepta el dominio permitido sin importar mayúsculas', () => {
    expect(isAllowedEmail('ana@grupokelsoft.com', 'grupokelsoft.com')).toBe(true)
    expect(isAllowedEmail('Ana.Perez@GrupoKelsoft.com', 'grupokelsoft.com')).toBe(true)
  })

  it('rechaza otros dominios y dominios parecidos', () => {
    expect(isAllowedEmail('ana@gmail.com', 'grupokelsoft.com')).toBe(false)
    expect(isAllowedEmail('ana@grupokelsoft.com.ar', 'grupokelsoft.com')).toBe(false)
    expect(isAllowedEmail('ana@sub.grupokelsoft.com', 'grupokelsoft.com')).toBe(false)
    expect(isAllowedEmail('a@b@grupokelsoft.com', 'grupokelsoft.com')).toBe(false)
    expect(isAllowedEmail('@grupokelsoft.com', 'grupokelsoft.com')).toBe(false)
  })

  it('rechaza emails vacíos', () => {
    expect(isAllowedEmail(undefined, 'grupokelsoft.com')).toBe(false)
    expect(isAllowedEmail('', 'grupokelsoft.com')).toBe(false)
  })
})

describe('readAuthErrorFromUrl', () => {
  it('lee el error de la query', () => {
    const url = new URL('http://localhost:5173/?error=access_denied&error_description=Solo+pueden+ingresar')
    expect(readAuthErrorFromUrl(url)).toBe('Solo pueden ingresar')
  })

  it('lee el error del hash', () => {
    const url = new URL('http://localhost:5173/#error=server_error&error_description=Hook+rechazado')
    expect(readAuthErrorFromUrl(url)).toBe('Hook rechazado')
  })

  it('devuelve null sin error', () => {
    expect(readAuthErrorFromUrl(new URL('http://localhost:5173/?code=abc'))).toBeNull()
  })
})

describe('DOMAIN_ERROR_MESSAGE', () => {
  it('usa el texto de la especificación', () => {
    expect(DOMAIN_ERROR_MESSAGE).toBe('Solo pueden ingresar cuentas @grupokelsoft.com')
  })
})
