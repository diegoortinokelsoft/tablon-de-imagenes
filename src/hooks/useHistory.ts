import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** Competencias archivadas, de la más reciente a la más antigua. */
export function useArchivedRounds() {
  return useQuery({
    queryKey: ['history', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('id, name, finalized_at, archived_at, winner_submission_id')
        .eq('status', 'archived')
        .order('archived_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

/** La competencia archivada más reciente (para enlazar su resultado desde la vista "Preparada"). */
export function useLatestArchivedRound() {
  return useQuery({
    queryKey: ['history', 'latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('id, name')
        .eq('status', 'archived')
        .order('archived_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
