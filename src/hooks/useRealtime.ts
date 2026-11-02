import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { HUB_QUERY_KEYS, REALTIME_DEBOUNCE_MS, ROUND_QUERY_KEYS, debounce, statusChangeMessage } from '../lib/realtime'
import { supabase } from '../lib/supabase'
import type { RoundStatus } from '../lib/labels'
import { useSession } from './useSession'
import { useToast } from './useToast'

/**
 * Abre un canal de postgres_changes y, ante cualquier evento, invalida las consultas indicadas
 * (con debounce de 300 ms) para volver a leerlas. No aplica el cambio a mano. También al reconectar.
 */
function useInvalidatingChannel(
  name: string | null,
  keys: readonly string[],
  listen: (channel: RealtimeChannel, refresh: () => void) => RealtimeChannel,
) {
  const { session } = useSession()
  const queryClient = useQueryClient()
  const accessToken = session?.access_token
  const listenRef = useRef(listen)
  listenRef.current = listen

  useEffect(() => {
    if (!accessToken || !name) return
    void supabase.realtime.setAuth(accessToken)

    const refresh = debounce(() => {
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: [key] })
    }, REALTIME_DEBOUNCE_MS)

    let wasSubscribed = false
    const channel = listenRef.current(supabase.channel(name), refresh).subscribe((status) => {
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
  }, [accessToken, name, keys, queryClient])
}

/** Canal de una competencia: su fila, sus publicaciones, votos, miembros y solicitudes. */
export function useRoundRealtime(roundId: string | undefined) {
  useInvalidatingChannel(roundId ? `round:${roundId}` : null, ROUND_QUERY_KEYS, (channel, refresh) => {
    const byRound = `round_id=eq.${roundId}`
    return channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `id=eq.${roundId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: byRound }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes', filter: byRound }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_members', filter: byRound }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests', filter: byRound }, refresh)
  })
}

/** Canal del hub: competencias, miembros y solicitudes (RLS filtra lo que cada uno recibe). */
export function useHubRealtime() {
  useInvalidatingChannel('hub', HUB_QUERY_KEYS, (channel, refresh) =>
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_members' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, refresh),
  )
}

/** Avisa con un toast cuando cambia el estado de la competencia que se está mirando (la vista cambia sola). */
export function useRoundStatusNotice(roundId: string | undefined, status: RoundStatus | undefined) {
  const { notify } = useToast()
  const previous = useRef<{ roundId: string; status: RoundStatus } | null>(null)

  useEffect(() => {
    if (!roundId || !status) return
    const before = previous.current?.roundId === roundId ? previous.current.status : null
    const message = statusChangeMessage(before, status)
    if (message) notify(message, 'info')
    previous.current = { roundId, status }
  }, [roundId, status, notify])
}
