import { describe, expect, it } from 'vitest'
import tailwindConfig from '../../tailwind.config'
import { RESULT_COLORS, fitText, resultFilename, wrapText } from './resultImage'

// Cada carácter mide 10 px: fácil de razonar.
const measure = (text: string) => text.length * 10

describe('fitText', () => {
  it('deja el texto que entra', () => {
    expect(fitText('Hola', 40, measure)).toBe('Hola')
  })

  it('recorta con "…" el que no entra', () => {
    expect(fitText('Hola mundo', 50, measure)).toBe('Hola…')
  })
})

describe('wrapText', () => {
  it('parte en líneas por palabras', () => {
    expect(wrapText('uno dos tres cuatro', 80, measure, 3)).toEqual(['uno dos', 'tres', 'cuatro'])
  })

  it('si no entra en maxLines, la última línea termina en "…"', () => {
    expect(wrapText('uno dos tres cuatro cinco', 80, measure, 2)).toEqual(['uno dos', 'tres cu…'])
  })

  it('una palabra más larga que el ancho se recorta', () => {
    expect(wrapText('supercalifragilístico', 60, measure, 2)).toEqual(['super…'])
  })
})

describe('resultFilename', () => {
  it('arma un nombre de archivo sin tildes ni símbolos', () => {
    expect(resultFilename('¡Mejor Fondo de Pantalla!')).toBe('resultado-mejor-fondo-de-pantalla.png')
    expect(resultFilename('???')).toBe('resultado-competencia.png')
  })
})

describe('RESULT_COLORS', () => {
  it('usa los mismos valores que los tokens de tailwind.config.ts', () => {
    const colors = tailwindConfig.theme?.extend?.colors as Record<string, Record<string, string> | string>
    const night = colors.night as Record<string, string>
    const brand = colors.brand as Record<string, string>
    const onNight = colors['on-night'] as Record<string, string>
    expect(RESULT_COLORS).toEqual({
      night900: night['900'],
      night800: night['800'],
      brand600: brand['600'],
      brand400: brand['400'],
      onNight: onNight.DEFAULT,
      onNightMuted: onNight.muted,
      sun: colors.sun,
      vote: colors.vote,
    })
  })
})
