import { useCallback, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImageOff, LoaderCircle } from 'lucide-react'
import Lightbox from '../components/Lightbox'
import MySubmissionPanel from '../components/MySubmissionPanel'
import SubmissionCard from '../components/SubmissionCard'
import { useBoard } from '../hooks/useBoard'
import { useCurrentRound } from '../hooks/useCurrentRound'
import { useMyVotes } from '../hooks/useMyVotes'
import { useSession } from '../hooks/useSession'
import { useSignedUrls } from '../hooks/useSignedUrls'
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
  const { data: items = [], isPending } = useBoard(roundId)
  const { data: myVotes } = useMyVotes()
  const { data: voters = {} } = useVoteDetails(roundId)
  const { data: urls = {} } = useSignedUrls(items.map((item) => item.imagePath))
  const [order, setOrder] = useState<SortOrder>('recent')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<BoardItem | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])

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
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-96">
        <MySubmissionPanel roundId={roundId} mine={mine} imageUrl={mine ? urls[mine.imagePath] : undefined} />
      </aside>

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
          <div className="flex justify-center py-12 text-on-night-muted" role="status">
            <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-label="Cargando publicaciones" />
          </div>
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
  const { data: round, isPending } = useCurrentRound()

  if (isPending) {
    return (
      <div className="flex justify-center py-12 text-on-night-muted" role="status">
        <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-label="Cargando" />
      </div>
    )
  }

  if (!round || round.status === 'pending') {
    return <Notice title="La competencia todavía no abrió">Vuelve cuando el administrador la abra.</Notice>
  }

  if (round.status !== 'open') {
    return <Notice title="La votación está cerrada" />
  }

  return <OpenBoard roundId={round.id} />
}
