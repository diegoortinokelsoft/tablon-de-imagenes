import { describe, expect, it } from 'vitest'
import { MAX_IMAGE_BYTES, firstImageFile, validateImageFile } from './image'

describe('validateImageFile', () => {
  it('acepta JPG, PNG y WEBP de hasta 5 MB', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1000 })).toBeNull()
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES })).toBeNull()
    expect(validateImageFile({ type: 'image/webp', size: 1 })).toBeNull()
  })

  it('rechaza más de 5 MB', () => {
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe('FILE_TOO_LARGE')
  })

  it('rechaza otros formatos antes que el tamaño', () => {
    expect(validateImageFile({ type: 'image/gif', size: 10 })).toBe('INVALID_FORMAT')
    expect(validateImageFile({ type: 'application/pdf', size: MAX_IMAGE_BYTES + 1 })).toBe('INVALID_FORMAT')
    expect(validateImageFile({ type: '', size: 10 })).toBe('INVALID_FORMAT')
  })
})

describe('firstImageFile', () => {
  const png = new File(['x'], 'captura.png', { type: 'image/png' })
  const txt = new File(['x'], 'nota.txt', { type: 'text/plain' })

  it('prefiere el primer archivo de imagen', () => {
    expect(firstImageFile([txt, png])).toBe(png)
  })

  it('si no hay imágenes devuelve el primero (para avisar del formato)', () => {
    expect(firstImageFile([txt])).toBe(txt)
  })

  it('devuelve null sin archivos', () => {
    expect(firstImageFile([])).toBeNull()
    expect(firstImageFile(null)).toBeNull()
  })
})
