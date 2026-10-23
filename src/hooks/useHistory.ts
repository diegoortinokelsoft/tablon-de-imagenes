import { useQuery } from '@tanstack/react-query'
import { toBoardItem } from '../lib/board'
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

/** Publicaciones ganadoras de las competencias archivadas, por id. */
export function useWinners(winnerIds: string[]) {
  const ids = [...new Set(winnerIds)].sort()
  return useQuery({
    queryKey: ['history', 'winners', ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('board').select('*').in('id', ids)
      if (error) throw error
      return Object.fromEntries(data.map((row) => [row.id ?? '', toBoardItem(row)]))
    },
  })
}

/** Una competencia por id (para el detalle del historial). */
export function useRound(roundId: string | undefined) {
  return useQuery({
    queryKey: ['history', 'round', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase.from('rounds').select('*').eq('id', roundId!).maybeSingle()
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
