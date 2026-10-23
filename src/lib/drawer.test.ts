import { describe, expect, it } from 'vitest'
import { DRAG_COMMIT_PX, clampDrag, resolveDrag } from './drawer'

describe('clampDrag', () => {
  it('oculto solo se arrastra hacia la derecha', () => {
    expect(clampDrag(false, 40)).toBe(40)
    expect(clampDrag(false, -40)).toBe(0)
  })

  it('abierto solo se arrastra hacia la izquierda', () => {
    expect(clampDrag(true, -40)).toBe(-40)
    expect(clampDrag(true, 40)).toBe(0)
  })
})

describe('resolveDrag', () => {
  it('un clic alterna el estado', () => {
    expect(resolveDrag(false, 0)).toBe('open')
    expect(resolveDrag(true, 2)).toBe('close')
  })

  it('arrastrar lo suficiente hacia la derecha abre', () => {
    expect(resolveDrag(false, DRAG_COMMIT_PX)).toBe('open')
    expect(resolveDrag(false, DRAG_COMMIT_PX - 1)).toBe('stay')
  })

  it('arrastrar lo suficiente hacia la izquierda cierra', () => {
    expect(resolveDrag(true, -DRAG_COMMIT_PX)).toBe('close')
    expect(resolveDrag(true, -(DRAG_COMMIT_PX - 1))).toBe('stay')
  })

  it('arrastrar en la dirección contraria no cambia nada', () => {
    expect(resolveDrag(false, -100)).toBe('stay')
    expect(resolveDrag(true, 100)).toBe('stay')
  })
})
