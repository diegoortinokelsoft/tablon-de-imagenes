import { useQuery } from '@tanstack/react-query'
import { getInviteToken } from '../lib/members'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

export interface Person {
  id: string
  name: string
  email: string
  avatar: string | null
}

function toPerson(id: string, profile: { full_name: string; email: string; avatar_url: string | null } | null): Person {
  return { id, name: profile?.full_name || profile?.email || '', email: profile?.email ?? '', avatar: profile?.avatar_url ?? null }
}

/** Miembros de una privada (RLS: el dueño y el superadmin ven todos; un miembro, solo el suyo). */
export function useMembers(roundId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['round_members', roundId],
    enabled: !!roundId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_members')
        .select('user_id, source, joined_at, profiles(full_name, email, avatar_url)')
        .eq('round_id', roundId!)
        .order('joined_at')
      if (error) throw error
      return data.map((row) => ({ ...toPerson(row.user_id, row.profiles), source: row.source, joinedAt: row.joined_at }))
    },
  })
}

/** Solicitudes pendientes de una competencia (las ve su dueño o el superadmin). */
export function usePendingRequests(roundId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['access_requests', roundId],
    enabled: !!roundId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('access_requests')
        .select('id, user_id, created_at, profiles(full_name, email, avatar_url)')
        .eq('round_id', roundId!)
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return data.map((row) => ({ requestId: row.id, createdAt: row.created_at, ...toPerson(row.user_id, row.profiles) }))
    },
  })
}

/** Si el usuario tiene una solicitud pendiente en la competencia. */
export function useMyPendingRequest(roundId: string | undefined, enabled = true) {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['access_requests', roundId, 'mine', userId],
    enabled: !!roundId && !!userId && enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('access_requests')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', roundId!)
        .eq('user_id', userId!)
        .eq('status', 'pending')
      if (error) throw error
      return (count ?? 0) > 0
    },
  })
}

/** Si el usuario es miembro de la competencia (para ofrecer "Salir"). */
export function useIsMember(roundId: string | undefined, enabled = true) {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['round_members', roundId, 'mine', userId],
    enabled: !!roundId && !!userId && enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('round_members')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', roundId!)
        .eq('user_id', userId!)
      if (error) throw error
      return (count ?? 0) > 0
    },
  })
}

/** Token del enlace de invitación (solo el dueño de una privada). */
export function useInviteToken(roundId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['invite_token', roundId],
    enabled: !!roundId && enabled,
    queryFn: () => getInviteToken(roundId!),
  })
}

/** Un perfil por id (por ejemplo, el dueño de una competencia). */
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data ? toPerson(data.id, data) : null
    },
  })
}

/** Perfiles que coinciden con la búsqueda (nombre o email), para agregar miembros. */
export function useProfileSearch(search: string) {
  const term = search.trim().replace(/[%_,()]/g, ' ').trim()
  return useQuery({
    queryKey: ['profile_search', term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
        .order('full_name')
        .limit(8)
      if (error) throw error
      return data.map((row) => toPerson(row.id, row))
    },
  })
}
