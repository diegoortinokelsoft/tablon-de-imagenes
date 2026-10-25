import { cleanRoundFiles } from './rounds'
import { supabase } from './supabase'

// Archivo y limpieza de competencias inactivas (superadmin). Las RPC verifican is_admin() por su cuenta.
// Borrar publicaciones o competencias ajenas usa deleteSubmission y deleteRound de lib/rounds.ts.

export async function fetchRoundsToArchive() {
  const { data, error } = await supabase.rpc('admin_rounds_to_archive')
  if (error) throw error
  return data
}

export async function fetchArchives() {
  const { data, error } = await supabase.rpc('admin_archives')
  if (error) throw error
  return data
}

/** Registra la exportación. driveUrl es null si el ZIP se descargó y se guardó a mano. */
export async function markExported(roundId: string, driveUrl: string | null) {
  const { error } = await supabase.rpc('admin_mark_exported', { p_round_id: roundId, p_drive_url: driveUrl ?? '' })
  if (error) throw error
}

/** Limpiar: RPC (guarda la lápida y borra los datos) → el cliente borra los archivos de Storage. */
export async function cleanRound(roundId: string) {
  const { data: cleanedId, error } = await supabase.rpc('admin_clean_round', { p_round_id: roundId })
  if (error) throw error
  return cleanRoundFiles(cleanedId)
}
