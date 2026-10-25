import type { RoundStatus, RoundVisibility } from './labels'
import { removeImages, removeRoundFolder } from './storage'
import { supabase } from './supabase'

// Acciones sobre una competencia. Las RPC verifican por su cuenta que quien llama sea el dueño
// (o el superadmin, para borrar); esto solo las llama y limpia Storage.

export async function createRound(name: string, visibility: RoundVisibility) {
  const { data, error } = await supabase.rpc('create_round', { p_name: name.trim(), p_visibility: visibility })
  if (error) throw error
  return data
}

export async function setRoundStatus(roundId: string, status: RoundStatus) {
  const { error } = await supabase.rpc('set_round_status', { p_round_id: roundId, p_status: status })
  if (error) throw error
}

export async function renameRound(roundId: string, name: string) {
  const { error } = await supabase.rpc('rename_round', { p_round_id: roundId, p_name: name.trim() })
  if (error) throw error
}

export async function setRoundVisibility(roundId: string, visibility: RoundVisibility) {
  const { error } = await supabase.rpc('set_round_visibility', { p_round_id: roundId, p_visibility: visibility })
  if (error) throw error
}

export async function finalizeRound(roundId: string, winnerSubmissionId: string) {
  const { error } = await supabase.rpc('finalize_round', {
    p_round_id: roundId,
    p_winner_submission_id: winnerSubmissionId,
  })
  if (error) throw error
}

/** Borrar una publicación (dueño o superadmin): RPC → borrar la ruta devuelta. */
export async function deleteSubmission(submissionId: string) {
  const { data: path, error } = await supabase.rpc('delete_submission', { p_submission_id: submissionId })
  if (error) throw error
  await removeImages([path])
}

/**
 * Limpieza de Storage después de borrar o limpiar una competencia. Si falla, la base ya quedó bien:
 * se informa para avisar, pero no se lanza el error.
 */
export async function cleanRoundFiles(roundId: string): Promise<{ filesOk: boolean }> {
  try {
    await removeRoundFolder(roundId)
    return { filesOk: true }
  } catch (error) {
    console.warn('No se pudieron borrar los archivos de la competencia', error)
    return { filesOk: false }
  }
}

/** Borrar la competencia (dueño o superadmin): RPC → el cliente borra todos sus archivos. */
export async function deleteRound(roundId: string) {
  const { data: deletedId, error } = await supabase.rpc('delete_round', { p_round_id: roundId })
  if (error) throw error
  return cleanRoundFiles(deletedId)
}
