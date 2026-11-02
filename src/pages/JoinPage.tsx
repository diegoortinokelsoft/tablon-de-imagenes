import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Link2Off } from 'lucide-react'
import { Loading } from '../components/StateMessages'
import { errorMessage } from '../lib/errors'
import { joinWithInvite } from '../lib/members'

/** /invitacion/:token: entra a la competencia privada y redirige a ella. */
export default function JoinPage() {
  const { token } = useParams()
  const queryClient = useQueryClient()
  const [result, setResult] = useState<{ roundId: string } | { error: string } | null>(null)
  const started = useRef(false)

  useEffect(() => {
    // Una sola vez, aunque StrictMode monte el efecto dos veces.
    if (started.current || !token) return
    started.current = true
    joinWithInvite(token)
      .then(async (roundId) => {
        await queryClient.invalidateQueries()
        setResult({ roundId })
      })
      .catch((error: unknown) => setResult({ error: errorMessage(error) }))
  }, [token, queryClient])

  if (!token) return <Navigate to="/" replace />
  if (!result) return <Loading label="Entrando a la competencia…" />
  if ('roundId' in result) return <Navigate to={`/c/${result.roundId}`} replace />

  return (
    <div className="mx-auto flex max-w-modal flex-col items-center gap-3 py-12 text-center">
      <Link2Off className="h-12 w-12 text-on-night-muted" strokeWidth={2.5} aria-hidden />
      <h1 className="page-title">No pudimos usar el enlace</h1>
      <p className="text-body text-on-night">{result.error}</p>
      <p className="text-body text-on-night-muted">
        Pídele a quien creó la competencia un enlace nuevo.{' '}
        <Link to="/" className="text-on-night underline">
          Volver a las competencias
        </Link>
      </p>
    </div>
  )
}
