import { describe, expect, it } from 'vitest'
import { STATUS_LABELS, formatDate, initials, suggestNextRoundName } from './labels'

describe('suggestNextRoundName', () => {
  it('incrementa el número final', () => {
    expect(suggestNextRoundName('Competencia 1')).toBe('Competencia 2')
    expect(suggestNextRoundName('Ronda 9')).toBe('Ronda 10')
  })

  it('sin número usa un nombre genérico', () => {
    expect(suggestNextRoundName('Navidad')).toBe('Nueva competencia')
    expect(suggestNextRoundName(undefined)).toBe('Nueva competencia')
  })
})

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
    expect(STATUS_LABELS).toMatchObject({
      pending: 'Preparada',
      open: 'Abierta',
      closed: 'Cerrada',
      finalized: 'Finalizada',
    })
  })
})
