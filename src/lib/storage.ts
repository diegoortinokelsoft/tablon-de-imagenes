import { supabase } from './supabase'

export const BUCKET = 'submissions'
export const SIGNED_URL_SECONDS = 60 * 60

/** Ruta de cada archivo: {round_id}/{user_id}/{uuid}.webp. Cada subida usa un nombre nuevo. */
export function buildImagePath(roundId: string, userId: string, id: string = crypto.randomUUID()): string {
  return `${roundId}/${userId}/${id}.webp`
}

export async function uploadImage(path: string, blob: Blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '3600',
  })
  if (error) throw error
}

/** Borra archivos sin lanzar: si falla, solo queda un archivo huérfano. */
export async function removeImages(paths: (string | null | undefined)[]) {
  const valid = paths.filter((path): path is string => !!path)
  if (valid.length === 0) return
  const { error } = await supabase.storage.from(BUCKET).remove(valid)
  if (error) console.warn('No se pudieron borrar archivos de Storage', error)
}

export const REMOVE_BATCH_SIZE = 100

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

/**
 * Reinicio total o borrar competencia archivada: lista las carpetas de usuario bajo
 * {round_id}/ y borra todos los objetos en lotes de hasta 100 (solo el admin puede).
 * Devuelve la cantidad de archivos borrados.
 */
export async function removeRoundFolder(roundId: string): Promise<number> {
  const bucket = supabase.storage.from(BUCKET)
  const { data: folders, error } = await bucket.list(roundId, { limit: 1000 })
  if (error) throw error

  const paths: string[] = []
  for (const folder of folders) {
    const prefix = `${roundId}/${folder.name}`
    if (folder.id) {
      paths.push(prefix) // archivo suelto directamente bajo la carpeta de la competencia
      continue
    }
    const { data: files, error: listError } = await bucket.list(prefix, { limit: 1000 })
    if (listError) throw listError
    for (const file of files) paths.push(`${prefix}/${file.name}`)
  }

  for (const batch of chunk(paths, REMOVE_BATCH_SIZE)) {
    const { error: removeError } = await bucket.remove(batch)
    if (removeError) throw removeError
  }
  return paths.length
}

/** URLs firmadas en lote para mostrar imágenes del bucket privado. */
export async function createSignedUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {}
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS)
  if (error) throw error
  const urls: Record<string, string> = {}
  for (const item of data) {
    if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
  }
  return urls
}
