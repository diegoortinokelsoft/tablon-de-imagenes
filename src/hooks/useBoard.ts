import { useQuery } from '@tanstack/react-query'
import { toBoardItem } from '../lib/board'
import { supabase } from '../lib/supabase'

/** Publicaciones de una competencia con autor, votos y posición. */
export function useBoard(roundId: string | undefined) {
  return useQuery({
    queryKey: ['board', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase.from('board').select('*').eq('round_id', roundId!)
      if (error) throw error
      return data.map(toBoardItem)
    },
  })
}
