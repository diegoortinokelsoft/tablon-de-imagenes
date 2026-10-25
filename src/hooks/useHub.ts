import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

export type HubRound = Database['public']['Functions']['hub_rounds']['Returns'][number]

/** Todas las competencias con lo que el usuario puede ver de cada una (ver hub_rounds en docs/supabase.md). */
export function useHub() {
  return useQuery({
    queryKey: ['hub'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('hub_rounds')
      if (error) throw error
      return data
    },
  })
}
