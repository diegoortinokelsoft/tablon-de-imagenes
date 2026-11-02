import { removeImages } from './storage'
import { supabase } from './supabase'

// Miembros, invitaciones y solicitudes de las competencias privadas. Las RPC verifican quién llama.

/** Enlace de invitación a partir del token (se abre en /invitacion/:token). */
export function inviteUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}/invitacion/${token}`
}

export async function getInviteToken(roundId: string) {
  const { data, error } = await supabase.rpc('get_invite_link', { p_round_id: roundId })
  if (error) throw error
  return data
}

export async function regenerateInviteToken(roundId: string) {
  const { data, error } = await supabase.rpc('regenerate_invite_link', { p_round_id: roundId })
  if (error) throw error
  return data
}

/** Entra con el enlace de invitación. Devuelve el id de la competencia. */
export async function joinWithInvite(token: string) {
  const { data, error } = await supabase.rpc('join_with_invite', { p_token: token })
  if (error) throw error
  return data
}

export async function addMember(roundId: string, userId: string) {
  const { error } = await supabase.rpc('add_member', { p_round_id: roundId, p_user_id: userId })
  if (error) throw error
}

/** Quitar a un miembro: RPC (borra su publicación y sus votos) → borrar su imagen, si tenía. */
export async function removeMember(roundId: string, userId: string) {
  const { data: path, error } = await supabase.rpc('remove_member', { p_round_id: roundId, p_user_id: userId })
  if (error) throw error
  await removeImages([path])
}

/** Salir de la competencia: igual que quitar, sobre uno mismo. */
export async function leaveRound(roundId: string) {
  const { data: path, error } = await supabase.rpc('leave_round', { p_round_id: roundId })
  if (error) throw error
  await removeImages([path])
}

export async function requestAccess(roundId: string) {
  const { error } = await supabase.rpc('request_access', { p_round_id: roundId })
  if (error) throw error
}

export async function resolveAccessRequest(requestId: string, approve: boolean) {
  const { error } = await supabase.rpc('resolve_access_request', { p_request_id: requestId, p_approve: approve })
  if (error) throw error
}
