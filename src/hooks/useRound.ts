import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'

export type Round = Tables<'rounds'>
export type { RoundStatus } from '../lib/labels'

/** Datos generales de una competencia (los ve todo el dominio, aunque sea privada). Null si no existe. */
export function useRound(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase.from('rounds').select('*').eq('id', roundId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/** Si el usuario puede ver el contenido (publicaciones, votos e imágenes) de la competencia. */
export function useRoundAccess(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round_access', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_view_round', { p_round_id: roundId! })
      if (error) throw error
      return data === true
    },
  })
}

/** Personas que participaron (publicaron o votaron), publicaciones y votos. Solo el dueño o el superadmin. */
export function useRoundStats(roundId: string | undefined) {
  return useQuery({
    queryKey: ['round_stats', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('round_stats', { p_round_id: roundId! }).single()
      if (error) throw error
      return data
    },
  })
}
