import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useSession } from '../hooks/useSession'
import { clearRedirect, peekRedirect, rememberRedirect } from '../lib/auth'
import FullScreenLoader from './FullScreenLoader'

/**
 * Solo usuarios con sesión; los demás van a /login. La ruta pedida se recuerda y, al volver
 * de Google (que siempre vuelve al inicio), se retoma: así funciona un enlace de invitación sin sesión.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()
  const here = location.pathname + location.search

  if (loading) return <FullScreenLoader />
  if (!session) {
    rememberRedirect(here)
    return <Navigate to="/login" replace />
  }
  const pending = peekRedirect()
  if (pending) {
    if (pending !== here) return <Navigate to={pending} replace />
    clearRedirect()
  }
  return children
}

/** Solo el admin; los demás son redirigidos a /. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()
  if (loading) return <FullScreenLoader />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

/** /historial/:roundId de la v1 → /c/:roundId (una finalizada es su propio historial). */
export function LegacyHistoryRedirect() {
  const { roundId } = useParams()
  return <Navigate to={roundId ? `/c/${roundId}` : '/'} replace />
}
