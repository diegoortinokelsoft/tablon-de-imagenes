import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { REALTIME_DEBOUNCE_MS, REALTIME_QUERY_KEYS, debounce, statusChangeMessage } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import { useCurrentRound } from './useCurrentRound'
import { useSession } from './useSession'
import { useToast } from './useToast'

/**
 * Un solo canal "board" con postgres_changes sobre rounds, submissions y votes.
 * Ante cualquier evento no se aplica el cambio a mano: se invalidan las consultas
 * (con debounce de 300 ms) y se vuelven a leer. También al reconectar el canal.
 */
export function useRealtime() {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const accessToken = session?.access_token

  useEffect(() => {
    if (!accessToken) return
    void supabase.realtime.setAuth(accessToken)

    const refresh = debounce(() => {
      for (const key of REALTIME_QUERY_KEYS) void queryClient.invalidateQueries({ queryKey: [key] })
    }, REALTIME_DEBOUNCE_MS)

    let wasSubscribed = false
    const channel = supabase
      .channel('board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, refresh)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Al reconectar pudieron perderse eventos: se vuelve a leer todo.
          if (wasSubscribed) refresh()
          wasSubscribed = true
        }
      })

    return () => {
      refresh.cancel()
      void supabase.removeChannel(channel)
    }
  }, [accessToken, queryClient])
}

/** Avisa con un toast cuando cambia el estado de la competencia (la vista cambia sola). */
export function useRoundStatusNotice() {
  const { data: round } = useCurrentRound()
  const { notify } = useToast()
  const previous = useRef<{ id: string; status: NonNullable<typeof round>['status'] } | null>(null)

  useEffect(() => {
    if (!round) return
    const next = { id: round.id, status: round.status }
    const message = statusChangeMessage(previous.current, next)
    if (message) notify(message, 'info')
    previous.current = next
  }, [round, notify])
}
