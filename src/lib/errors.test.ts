import { describe, expect, it } from 'vitest'
import { ERROR_MESSAGES, GENERIC_ERROR_MESSAGE, errorCode, errorMessage } from './errors'

describe('errorCode', () => {
  it('reconoce el código de un error de PostgREST', () => {
    expect(errorCode({ message: 'NO_VOTES_LEFT', code: 'P0001' })).toBe('NO_VOTES_LEFT')
  })

  it('no confunde códigos que son prefijo de otros', () => {
    expect(errorCode({ message: 'NOT_ADMIN' })).toBe('NOT_ADMIN')
    expect(errorCode({ message: 'NOT_ALLOWED' })).toBe('NOT_ALLOWED')
  })

  it('devuelve null para mensajes desconocidos', () => {
    expect(errorCode(new Error('Failed to fetch'))).toBeNull()
    expect(errorCode(undefined)).toBeNull()
  })
})

describe('errorMessage', () => {
  it('traduce los mensajes que pide la especificación', () => {
    expect(errorMessage({ message: 'ROUND_NOT_OPEN' })).toBe('La competencia no está abierta')
    expect(errorMessage({ message: 'ALREADY_SUBMITTED' })).toBe('Ya tienes una publicación')
    expect(errorMessage({ message: 'OWN_SUBMISSION' })).toBe('No puedes votar tu propia publicación')
    expect(errorMessage({ message: 'NO_VOTES_LEFT' })).toBe('Ya usaste tus 3 votos')
    expect(errorMessage('FILE_TOO_LARGE')).toBe('La imagen supera los 5 MB')
    expect(errorMessage('INVALID_FORMAT')).toBe('Formato no admitido: usa JPG, PNG o WEBP')
  })

  it('usa un mensaje genérico en español para errores desconocidos', () => {
    expect(errorMessage(new Error('boom'))).toBe(GENERIC_ERROR_MESSAGE)
  })

  it('tiene mensaje para todos los códigos de la especificación', () => {
    for (const code of [
      'NOT_ALLOWED', 'NOT_ADMIN', 'ROUND_NOT_OPEN', 'ALREADY_SUBMITTED', 'NO_SUBMISSION', 'INVALID_PATH',
      'INVALID_TITLE', 'OWN_SUBMISSION', 'NO_VOTES_LEFT', 'NO_VOTE_TO_REMOVE', 'INVALID_TRANSITION', 'INVALID_WINNER',
    ]) {
      expect(ERROR_MESSAGES).toHaveProperty(code)
    }
  })

  it('tiene mensaje para todos los códigos de la v2', () => {
    for (const code of [
      'NO_ACCESS', 'NOT_OWNER', 'ROUND_NOT_FOUND', 'ROUND_LIMIT', 'ROUND_CLEANED', 'VISIBILITY_LOCKED',
      'NOT_PRIVATE', 'INVALID_INVITE', 'ALREADY_HAS_ACCESS', 'REQUEST_PENDING', 'NO_REQUEST', 'NOT_MEMBER',
      'USER_NOT_FOUND', 'NOT_INACTIVE', 'NOT_EXPORTED',
    ]) {
      expect(ERROR_MESSAGES).toHaveProperty(code)
    }
  })

  it('traduce los errores de acceso a competencias', () => {
    expect(errorMessage({ message: 'NO_ACCESS' })).toBe('No tienes acceso a esta competencia')
    expect(errorMessage({ message: 'ROUND_LIMIT' })).toBe(
      'Ya tienes 2 competencias activas. Finaliza o borra una para crear otra',
    )
  })
})
