import type { RoundStatus } from './labels'
import { removeImages, removeRoundFolder } from './storage'
import { supabase } from './supabase'

// Las RPC verifican is_admin() por su cuenta; esto solo las llama y limpia Storage.

export async function setRoundStatus(status: RoundStatus) {
  const { error } = await supabase.rpc('admin_set_round_status', { p_status: status })
  if (error) throw error
}

export async function renameRound(name: string) {
  const { error } = await supabase.rpc('admin_rename_round', { p_name: name.trim() })
  if (error) throw error
}

export async function finalizeRound(winnerSubmissionId: string) {
  const { error } = await supabase.rpc('admin_finalize_round', { p_winner_submission_id: winnerSubmissionId })
  if (error) throw error
}

export async function startNewRound(name: string) {
  const { error } = await supabase.rpc('admin_start_new_round', { p_name: name.trim() })
  if (error) throw error
}

/** Borrar (admin): RPC → borrar la ruta devuelta. */
export async function deleteSubmissionAsAdmin(submissionId: string) {
  const { data: path, error } = await supabase.rpc('admin_delete_submission', { p_submission_id: submissionId })
  if (error) throw error
  await removeImages([path])
}

/**
 * Limpieza de Storage después de borrar una competencia. Si falla, la base ya quedó bien:
 * se informa para avisar, pero no se lanza el error.
 */
async function cleanRoundFiles(roundId: string): Promise<{ filesOk: boolean }> {
  try {
    await removeRoundFolder(roundId)
    return { filesOk: true }
  } catch (error) {
    console.warn('No se pudieron borrar los archivos de la competencia', error)
    return { filesOk: false }
  }
}

/** Reinicio total: RPC → el cliente borra todos los archivos de la competencia borrada. */
export async function hardReset(name: string) {
  const { data: deletedId, error } = await supabase.rpc('admin_hard_reset', { p_name: name.trim() })
  if (error) throw error
  return deletedId ? cleanRoundFiles(deletedId) : { filesOk: true }
}

/** Eliminar del historial: RPC → el cliente borra todos los archivos de esa competencia. */
export async function deleteArchivedRound(roundId: string) {
  const { data: deletedId, error } = await supabase.rpc('admin_delete_archived_round', { p_round_id: roundId })
  if (error) throw error
  return cleanRoundFiles(deletedId)
}
