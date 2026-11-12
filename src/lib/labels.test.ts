import { describe, expect, it } from 'vitest'
import { STATUS_LABELS, VISIBILITY_LABELS, formatDate, importedMembersMessage, initials, memberCountLabel } from './labels'

describe('formatDate', () => {
  it('formatea en español', () => {
    expect(formatDate('2026-10-23T12:00:00Z')).toContain('octubre')
    expect(formatDate(null)).toBe('')
  })
})

describe('initials', () => {
  it('usa la primera letra del primer y último nombre', () => {
    expect(initials('Ana María Núñez')).toBe('AN')
    expect(initials('beto')).toBe('B')
  })

  it('devuelve ? si no hay nombre', () => {
    expect(initials('   ')).toBe('?')
  })
})

describe('STATUS_LABELS', () => {
  it('usa las etiquetas de la especificación', () => {
    expect(STATUS_LABELS).toEqual({
      pending: 'Preparada',
      open: 'Abierta',
      closed: 'Cerrada',
      finalized: 'Finalizada',
    })
  })
})

describe('VISIBILITY_LABELS', () => {
  it('nombra las dos visibilidades', () => {
    expect(VISIBILITY_LABELS).toEqual({ public: 'Pública', private: 'Privada' })
  })
})

describe('memberCountLabel', () => {
  it('usa el singular solo con 1', () => {
    expect(memberCountLabel(0)).toBe('0 miembros')
    expect(memberCountLabel(1)).toBe('1 miembro')
    expect(memberCountLabel(3)).toBe('3 miembros')
  })
})

describe('importedMembersMessage', () => {
  it('informa cuántas personas se sumaron', () => {
    expect(importedMembersMessage(0)).toBe('No se sumó nadie nuevo')
    expect(importedMembersMessage(1)).toBe('Se sumó 1 persona')
    expect(importedMembersMessage(3)).toBe('Se sumaron 3 personas')
  })
})
