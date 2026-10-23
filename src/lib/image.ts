import imageCompression from 'browser-image-compression'

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',')

export type ImageValidationError = 'INVALID_FORMAT' | 'FILE_TOO_LARGE'

/** Valida el archivo original antes de comprimirlo: JPG, PNG o WEBP, hasta 5 MB. */
export function validateImageFile(file: Pick<File, 'type' | 'size'>): ImageValidationError | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return 'INVALID_FORMAT'
  if (file.size > MAX_IMAGE_BYTES) return 'FILE_TOO_LARGE'
  return null
}

export interface CompressedImage {
  blob: Blob
  width: number
  height: number
}

/** Comprime a WEBP con lado máximo de 2560 px (mantiene legible el texto de las capturas). */
export async function compressImage(file: File): Promise<CompressedImage> {
  const blob = await imageCompression(file, {
    fileType: 'image/webp',
    maxWidthOrHeight: 2560,
    maxSizeMB: 1,
    initialQuality: 0.85,
    useWebWorker: true,
  })
  const bitmap = await createImageBitmap(blob)
  const size = { width: bitmap.width, height: bitmap.height }
  bitmap.close()
  return { blob, ...size }
}

/** Primer archivo de imagen de un portapapeles o de un arrastre. */
export function firstImageFile(files: FileList | File[] | null | undefined): File | null {
  if (!files) return null
  return Array.from(files).find((file) => file.type.startsWith('image/')) ?? Array.from(files)[0] ?? null
}
