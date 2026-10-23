import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { SessionContext, type SessionState } from '../hooks/useSession'
import {
  DOMAIN_ERROR_MESSAGE,
  authErrorMessage,
  isAllowedEmail,
  readAuthErrorFromUrl,
  setLoginFlash,
  signOut,
} from '../lib/auth'
import { env } from '../lib/env'
import { errorCode } from '../lib/errors'
import { supabase } from '../lib/supabase'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true })
  const syncedUserId = useRef<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    // Error de vuelta de Google (por ejemplo, el hook rechazó otro dominio).
    const urlError = readAuthErrorFromUrl(new URL(window.location.href))
    if (urlError) {
      setLoginFlash(authErrorMessage(urlError))
      window.history.replaceState(null, '', window.location.pathname)
    }

    const rejectDomain = () => {
      setLoginFlash(DOMAIN_ERROR_MESSAGE)
      syncedUserId.current = null
      void signOut()
    }

    // Actualiza nombre y avatar desde Google una vez por inicio de sesión.
    const syncProfile = async (userId: string) => {
      if (syncedUserId.current === userId) return
      syncedUserId.current = userId
      const { error } = await supabase.rpc('sync_my_profile')
      if (errorCode(error) === 'NOT_ALLOWED') rejectDomain()
    }

    const apply = (session: Session | null) => {
      if (session && !isAllowedEmail(session.user.email, env.allowedDomain)) {
        rejectDomain()
        setState({ session: null, loading: false })
        return
      }
      if (!session) {
        syncedUserId.current = null
        queryClient.clear()
      } else {
        // Fuera del callback de onAuthStateChange para no bloquear al cliente de Auth.
        setTimeout(() => void syncProfile(session.user.id), 0)
      }
      setState({ session, loading: false })
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session))
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>
}
