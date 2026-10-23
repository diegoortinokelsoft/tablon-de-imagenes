import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'

export type Round = Tables<'rounds'>
export type { RoundStatus } from '../lib/labels'

export function useCurrentRound() {
  return useQuery({
    queryKey: ['current_round'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rounds').select('*').neq('status', 'archived').maybeSingle()
      if (error) throw error
      return data
    },
  })
}
