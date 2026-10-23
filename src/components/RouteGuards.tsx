import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useSession } from '../hooks/useSession'
import FullScreenLoader from './FullScreenLoader'

/** Solo usuarios con sesión; los demás van a /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()
  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace />
  return children
}

/** Solo el admin; los demás son redirigidos a /. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useIsAdmin()
  if (loading) return <FullScreenLoader />
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}
