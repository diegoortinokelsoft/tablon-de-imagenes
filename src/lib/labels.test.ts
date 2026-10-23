import { describe, expect, it } from 'vitest'
import { STATUS_LABELS, initials } from './labels'

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
