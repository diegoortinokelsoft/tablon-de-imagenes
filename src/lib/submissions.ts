import type { CompressedImage } from './image'
import { buildImagePath, removeImages, uploadImage } from './storage'
import { supabase } from './supabase'

// Flujos de archivo de la especificación ("Storage de imágenes → Flujos de archivo").

/** Publicar: subir el archivo → create_submission. Si la RPC falla, se borra el archivo recién subido. */
export async function publishSubmission(roundId: string, userId: string, title: string, image: CompressedImage) {
  const path = buildImagePath(roundId, userId)
  await uploadImage(path, image.blob)
  const { data, error } = await supabase.rpc('create_submission', {
    p_title: title.trim(),
    p_image_path: path,
    p_width: image.width,
    p_height: image.height,
  })
  if (error) {
    await removeImages([path])
    throw error
  }
  return data
}

/** Reemplazar: subir el nuevo → replace_submission_image → borrar la ruta anterior que devuelve la RPC. */
export async function replaceSubmissionImage(roundId: string, userId: string, image: CompressedImage) {
  const path = buildImagePath(roundId, userId)
  await uploadImage(path, image.blob)
  const { data: oldPath, error } = await supabase.rpc('replace_submission_image', {
    p_image_path: path,
    p_width: image.width,
    p_height: image.height,
  })
  if (error) {
    await removeImages([path])
    throw error
  }
  await removeImages([oldPath])
}

/** Borrar: RPC → borrar la ruta devuelta. */
export async function deleteMySubmission() {
  const { data: path, error } = await supabase.rpc('delete_my_submission')
  if (error) throw error
  await removeImages([path])
}

export async function updateSubmissionTitle(title: string) {
  const { error } = await supabase.rpc('update_submission_title', { p_title: title.trim() })
  if (error) throw error
}
