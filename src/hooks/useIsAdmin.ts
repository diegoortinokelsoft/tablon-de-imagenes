import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

// Solo decide si se muestra el panel; la seguridad real está en las RPC de administración.
export function useIsAdmin() {
  const { session } = useSession()
  const userId = session?.user.id
  const query = useQuery({
    queryKey: ['is_admin', userId],
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin')
      if (error) throw error
      return data
    },
  })
  return { isAdmin: query.data === true, loading: !!userId && query.isPending }
}
