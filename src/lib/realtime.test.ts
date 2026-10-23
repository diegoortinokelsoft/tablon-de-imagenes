import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoundStatus } from './labels'
import { debounce, statusChangeMessage } from './realtime'

describe('statusChangeMessage', () => {
  const r = (status: RoundStatus, id = 'r1') => ({ id, status })

  it('avisa que la votación se cerró', () => {
    expect(statusChangeMessage(r('open'), r('closed'))).toBe('La votación se cerró')
  })

  it('avisa la reapertura, la apertura y el ganador', () => {
    expect(statusChangeMessage(r('closed'), r('open'))).toBe('La votación se reabrió')
    expect(statusChangeMessage(r('pending'), r('open'))).toBe('¡La competencia abrió!')
    expect(statusChangeMessage(r('closed'), r('finalized'))).toBe('¡Ya hay ganador!')
  })

  it('avisa una competencia nueva', () => {
    expect(statusChangeMessage(r('finalized'), r('pending', 'r2'))).toBe('Empezó una nueva competencia')
  })

  it('no avisa sin cambio ni en la primera carga', () => {
    expect(statusChangeMessage(r('open'), r('open'))).toBeNull()
    expect(statusChangeMessage(null, r('open'))).toBeNull()
  })
})

describe('debounce', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ejecuta una sola vez después de una ráfaga', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const run = debounce(fn, 300)
    run()
    vi.advanceTimersByTime(200)
    run()
    run()
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('cancel evita la ejecución pendiente', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const run = debounce(fn, 300)
    run()
    run.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })
})
