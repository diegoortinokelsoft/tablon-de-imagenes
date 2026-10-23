import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

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
