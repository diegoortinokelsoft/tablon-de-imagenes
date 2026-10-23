import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Voter {
  voterId: string
  name: string
  avatar: string | null
  count: number
}

/** Quién votó cada publicación de la competencia y cuántas veces. */
export function useVoteDetails(roundId: string | undefined) {
  return useQuery({
    queryKey: ['vote_details', roundId],
    enabled: !!roundId,
    queryFn: async () => {
      const { data, error } = await supabase.from('vote_details').select('*').eq('round_id', roundId!)
      if (error) throw error
      const bySubmission: Record<string, Voter[]> = {}
      for (const row of data) {
        if (!row.submission_id || !row.voter_id) continue
        ;(bySubmission[row.submission_id] ??= []).push({
          voterId: row.voter_id,
          name: row.voter_name ?? '',
          avatar: row.voter_avatar,
          count: row.vote_count ?? 0,
        })
      }
      for (const voters of Object.values(bySubmission)) {
        voters.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      }
      return bySubmission
    },
  })
}
