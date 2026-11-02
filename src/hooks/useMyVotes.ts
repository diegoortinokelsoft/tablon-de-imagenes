import { useQuery } from '@tanstack/react-query'
import { summarizeMyVotes } from '../lib/board'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

/** Votos propios en una competencia: por publicación y los que quedan. */
export function useMyVotes(roundId: string | undefined) {
  const { session } = useSession()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['my_votes', roundId, userId],
    enabled: !!roundId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('votes')
        .select('submission_id')
        .eq('round_id', roundId!)
        .eq('voter_id', userId!)
      if (error) throw error
      return summarizeMyVotes(data.map((vote) => vote.submission_id))
    },
  })
}
