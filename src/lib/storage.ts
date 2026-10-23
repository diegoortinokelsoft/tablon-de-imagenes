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
