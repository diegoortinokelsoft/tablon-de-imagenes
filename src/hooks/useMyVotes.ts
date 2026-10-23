import { useQuery } from '@tanstack/react-query'
import { summarizeMyVotes } from '../lib/board'
import { supabase } from '../lib/supabase'
import { useCurrentRound } from './useCurrentRound'
import { useSession } from './useSession'

/** Votos propios en la competencia actual: por publicación y los que quedan. */
export function useMyVotes() {
  const { session } = useSession()
  const { data: round } = useCurrentRound()
  const userId = session?.user.id
  const roundId = round?.id
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
