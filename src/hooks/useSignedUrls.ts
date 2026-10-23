import { useQuery } from '@tanstack/react-query'
import { createSignedUrls } from '../lib/storage'

const FIFTY_MINUTES = 50 * 60 * 1000

/** URLs firmadas (1 h) en lote; se renuevan a los 50 minutos. */
export function useSignedUrls(paths: string[]) {
  const sorted = [...new Set(paths.filter(Boolean))].sort()
  return useQuery({
    queryKey: ['signed_urls', sorted],
    enabled: sorted.length > 0,
    staleTime: FIFTY_MINUTES,
    refetchInterval: FIFTY_MINUTES,
    refetchOnWindowFocus: false,
    queryFn: () => createSignedUrls(sorted),
  })
}
