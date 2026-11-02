import { afterEach, describe, expect, it, vi } from 'vitest'
import { debounce, statusChangeMessage } from './realtime'

describe('statusChangeMessage', () => {
  it('avisa que la votación se cerró', () => {
    expect(statusChangeMessage('open', 'closed')).toBe('La votación se cerró')
  })

  it('avisa la reapertura, la apertura y el ganador', () => {
    expect(statusChangeMessage('closed', 'open')).toBe('La votación se reabrió')
    expect(statusChangeMessage('pending', 'open')).toBe('¡La competencia abrió!')
    expect(statusChangeMessage('closed', 'finalized')).toBe('¡Ya hay ganador!')
  })

  it('avisa cuando se borra la ganadora y vuelve al ranking', () => {
    expect(statusChangeMessage('finalized', 'closed')).toBe('La competencia volvió a la etapa de ranking')
  })

  it('no avisa sin cambio ni en la primera carga', () => {
    expect(statusChangeMessage('open', 'open')).toBeNull()
    expect(statusChangeMessage(null, 'open')).toBeNull()
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
