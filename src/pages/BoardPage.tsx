import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImageOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import Lightbox from '../components/Lightbox'
import RoundResults from '../components/RoundResults'
import { ErrorState, Loading } from '../components/StateMessages'
import SubmissionCard from '../components/SubmissionCard'
import SubmissionDrawer from '../components/SubmissionDrawer'
import { useBoard } from '../hooks/useBoard'
import { useCurrentRound } from '../hooks/useCurrentRound'
import { useLatestArchivedRound } from '../hooks/useHistory'
import { useMyVotes } from '../hooks/useMyVotes'
import { useSession } from '../hooks/useSession'
import { useSignedUrls } from '../hooks/useSignedUrls'
import { useSubmissionDrawer } from '../hooks/useSubmissionDrawer'
import { useToast } from '../hooks/useToast'
import { useVoteDetails } from '../hooks/useVoteDetails'
import { SORT_LABELS, sortItems, type BoardItem, type SortOrder } from '../lib/board'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-modal flex-col items-center gap-3 py-12 text-center">
      <h1 className="page-title">{title}</h1>
      {children && <p className="text-body text-on-night-muted">{children}</p>}
    </div>
  )
}

function OpenBoard({ roundId }: { roundId: string }) {
  const { session } = useSession()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const { data: items = [], isPending, isError, refetch } = useBoard(roundId)
  const { data: myVotes } = useMyVotes()
  const { data: voters = {} } = useVoteDetails(roundId)
  const { data: urls = {} } = useSignedUrls(items.map((item) => item.imagePath))
  const [order, setOrder] = useState<SortOrder>('recent')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<BoardItem | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const drawer = useSubmissionDrawer()
  const { setAvailable } = drawer

  // El botón del encabezado solo aparece mientras el cajón existe.
  useEffect(() => {
    setAvailable(true)
    return () => setAvailable(false)
  }, [setAvailable])

  const userId = session?.user.id
  const mine = items.find((item) => item.userId === userId)
  const sorted = sortItems(items, order)
  const votesLeft = myVotes?.left ?? 0

  // Sin votos optimistas: el botón se deshabilita mientras la RPC responde y luego se vuelve a leer.
  const vote = async (submissionId: string, delta: 1 | -1) => {
    setPendingId(submissionId)
    const { error } =
      delta === 1
        ? await supabase.rpc('cast_vote', { p_submission_id: submissionId })
        : await supabase.rpc('remove_vote', { p_submission_id: submissionId })
    if (error) notify(errorMessage(error), 'error')
    await Promise.all(
      ['board', 'my_votes', 'vote_details'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    )
    setPendingId(null)
  }

  return (
    <div
      className={`transition-[padding] duration-200 ease-out drawer-peek-clearance ${drawer.open ? 'lg:drawer-push' : ''}`}
    >
      <SubmissionDrawer roundId={roundId} mine={mine} imageUrl={mine ? urls[mine.imagePath] : undefined} />

      <section className="flex min-w-0 flex-1 flex-col gap-4" aria-labelledby="titulo-tablon">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 id="titulo-tablon" className="page-title">
            ¡A votar!
          </h1>
          <label className="flex items-center gap-3">
            <span className="text-label uppercase text-on-night-muted">Ordenar</span>
            <select
              className="input h-10 w-auto py-0 pr-10"
              value={order}
              onChange={(event) => setOrder(event.target.value as SortOrder)}
            >
              {(Object.keys(SORT_LABELS) as SortOrder[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isPending ? (
          <Loading label="Cargando publicaciones…" />
        ) : isError ? (
          <ErrorState message="No se pudieron cargar las publicaciones." onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border-3 border-dashed border-on-night-muted p-12 text-center text-on-night-muted">
            <ImageOff className="h-12 w-12" strokeWidth={2.5} aria-hidden />
            <p className="text-body">Todavía no hay publicaciones. ¡Sé la primera persona en subir la tuya!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((item) => (
              <SubmissionCard
                key={item.id}
                item={item}
                imageUrl={urls[item.imagePath]}
                isOwn={item.userId === userId}
                myVotes={myVotes?.bySubmission[item.id] ?? 0}
                votesLeft={votesLeft}
                voters={voters[item.id] ?? []}
                pending={pendingId === item.id}
                onVote={(delta) => void vote(item.id, delta)}
                onOpen={() => setLightbox(item)}
              />
            ))}
          </div>
        )}
      </section>

      {lightbox && urls[lightbox.imagePath] && (
        <Lightbox
          src={urls[lightbox.imagePath]!}
          title={lightbox.title}
          author={lightbox.authorName}
          onClose={closeLightbox}
        />
      )}
    </div>
  )
}

export default function BoardPage() {
  const { data: round, isPending, isError, refetch } = useCurrentRound()

  if (isPending) return <Loading />
  if (isError) return <ErrorState message="No se pudo cargar la competencia." onRetry={() => void refetch()} />

  if (!round || round.status === 'pending') return <PendingView />

  if (round.status === 'closed') {
    return (
      <div className="flex flex-col gap-8">
        <Notice title="La votación está cerrada">El administrador va a elegir al ganador.</Notice>
        <RoundResults roundId={round.id} winnerId={null} />
      </div>
    )
  }

  if (round.status === 'finalized') {
    return <RoundResults roundId={round.id} winnerId={round.winner_submission_id} />
  }

  return <OpenBoard roundId={round.id} />
}

function PendingView() {
  const { data: latest } = useLatestArchivedRound()
  return (
    <Notice title="La competencia todavía no abrió">
      Vuelve cuando el administrador la abra.
      {latest && (
        <>
          {' '}
          Mientras tanto, mira el{' '}
          <Link to={`/historial/${latest.id}`} className="text-on-night underline">
            resultado de {latest.name}
          </Link>
          .
        </>
      )}
    </Notice>
  )
}
