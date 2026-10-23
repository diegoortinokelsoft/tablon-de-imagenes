import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** Participantes con sesión (perfiles), publicaciones y votos emitidos en la competencia actual. */
export function useAdminStats(roundId: string | undefined) {
  return useQuery({
    queryKey: ['admin_stats', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
        const { count, error } = await query
        if (error) throw error
        return count ?? 0
      }
      const [participants, submissions, votes] = await Promise.all([
        count(supabase.from('profiles').select('*', { count: 'exact', head: true })),
        count(supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('round_id', roundId!)),
        count(supabase.from('votes').select('*', { count: 'exact', head: true }).eq('round_id', roundId!)),
      ])
      return { participants, submissions, votes }
    },
  })
}
