import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, Clock, ImageOff, Lock, LogOut } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import Lightbox from '../components/Lightbox'
import RoundResults from '../components/RoundResults'
import { ErrorState, Loading } from '../components/StateMessages'
import SubmissionCard from '../components/SubmissionCard'
import SubmissionDrawer from '../components/SubmissionDrawer'
import { useBoard } from '../hooks/useBoard'
import { useIsMember, useMyPendingRequest, useProfile } from '../hooks/useMembers'
import { useMyVotes } from '../hooks/useMyVotes'
import { useRoundRealtime, useRoundStatusNotice } from '../hooks/useRealtime'
import { useRound, useRoundAccess, type Round } from '../hooks/useRound'
import { useSession } from '../hooks/useSession'
import { useSignedUrls } from '../hooks/useSignedUrls'
import { useSubmissionDrawer } from '../hooks/useSubmissionDrawer'
import { useToast } from '../hooks/useToast'
import { useVoteDetails } from '../hooks/useVoteDetails'
import { SORT_LABELS, sortItems, type BoardItem, type SortOrder } from '../lib/board'
import { errorMessage } from '../lib/errors'
import { STATUS_LABELS } from '../lib/labels'
import { leaveRound, requestAccess } from '../lib/members'
import { supabase } from '../lib/supabase'

function Notice({ title, icon, children }: { title: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-modal flex-col items-center gap-3 py-12 text-center">
      {icon}
      <h1 className="page-title">{title}</h1>
      {children && <div className="text-body text-on-night-muted">{children}</div>}
    </div>
  )
}

function BackToHub() {
  return (
    <Link to="/" className="text-on-night underline">
      Volver a las competencias
    </Link>
  )
}

/** Privada sin acceso: datos generales y "Solicitar acceso" (o "Solicitud pendiente"). */
function LockedView({ round }: { round: Round }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const { data: owner } = useProfile(round.owner_id)
  const { data: pendingRequest, isPending } = useMyPendingRequest(round.id)
  const [sending, setSending] = useState(false)

  const ask = async () => {
    setSending(true)
    try {
      await requestAccess(round.id)
      notify('Solicitud enviada', 'success')
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      await Promise.all(['access_requests', 'hub'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
      setSending(false)
    }
  }

  return (
    <Notice title={round.name} icon={<Lock className="h-12 w-12 text-on-night-muted" strokeWidth={2.5} aria-hidden />}>
      <div className="flex flex-col items-center gap-4">
        <p>Esta competencia es privada: solo la ven quienes tienen acceso.</p>
        <p className="flex flex-wrap items-center justify-center gap-2 text-secondary">
          {owner && <Avatar name={owner.name} url={owner.avatar} on="night" />}
          {owner ? `Creada por ${owner.name} · ${STATUS_LABELS[round.status]}` : STATUS_LABELS[round.status]}
        </p>
        {pendingRequest ? (
          <p className="flex items-center gap-2 text-on-night">
            <Clock className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            Solicitud pendiente. La página se actualiza sola cuando la aprueben.
          </p>
        ) : (
          <button type="button" className="btn btn-primary" disabled={isPending || sending} onClick={() => void ask()}>
            {sending ? 'Enviando…' : 'Solicitar acceso'}
          </button>
        )}
        <BackToHub />
      </div>
    </Notice>
  )
}

/** Para miembros de una privada: salir borra su publicación y sus votos. */
function LeaveRound({ roundId }: { roundId: string }) {
  const { notify } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const leave = async () => {
    setLeaving(true)
    try {
      await leaveRound(roundId)
      await queryClient.invalidateQueries()
      notify('Saliste de la competencia', 'success')
      navigate('/', { replace: true })
    } catch (error) {
      notify(errorMessage(error), 'error')
      setLeaving(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex justify-center pt-8">
      <button
        type="button"
        className="flex items-center gap-2 text-secondary uppercase text-on-night-muted hover:text-on-night"
        onClick={() => setConfirming(true)}
      >
        <LogOut className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        Salir de la competencia
      </button>
      <ConfirmDialog
        open={confirming}
        title="¿Salir de la competencia?"
        confirmLabel={leaving ? 'Saliendo…' : 'Salir'}
        danger
        pending={leaving}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void leave()}
      >
        Se borrarán tu publicación y tus votos en esta competencia. Para volver a entrar vas a necesitar una invitación
        o que aprueben tu solicitud.
      </ConfirmDialog>
    </div>
  )
}

function OpenBoard({ roundId }: { roundId: string }) {
  const { session } = useSession()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const { data: items = [], isPending, isError, refetch } = useBoard(roundId)
  const { data: myVotes } = useMyVotes(roundId)
  const { data: voters = {} } = useVoteDetails(roundId)
  const { data: urls = {} } = useSignedUrls(items.map((item) => item.imagePath))
  const [order, setOrder] = useState<SortOrder>('recent')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [lightbox, setLightbox] = useState<BoardItem | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const drawer = useSubmissionDrawer()
  const { setAvailable, setOpen } = drawer
  const drawerInitialized = useRef(false)

  // El botón del encabezado solo aparece mientras el cajón existe.
  useEffect(() => {
    setAvailable(true)
    return () => setAvailable(false)
  }, [setAvailable])
  const userId = session?.user.id
  const mine = items.find((item) => item.userId === userId)
  const sorted = sortItems(items, order)
  const votesLeft = myVotes?.left ?? 0

  // Posición inicial al entrar al tablón: desplegado si todavía no publicó, oculto si ya publicó.
  // Solo una vez; después lo maneja la persona (publicar o borrar no lo mueve).
  useEffect(() => {
    if (isPending || isError || drawerInitialized.current) return
    drawerInitialized.current = true
    setOpen(!mine)
  }, [isPending, isError, mine, setOpen])

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

export default function RoundPage() {
  const { roundId } = useParams()
  const { notify } = useToast()
  const { data: round, isPending, isError, refetch } = useRound(roundId)
  const access = useRoundAccess(roundId)
  const { data: isMember } = useIsMember(roundId, round?.visibility === 'private')
  useRoundRealtime(roundId)
  useRoundStatusNotice(round?.id, round?.status)

  // Si le quitan el acceso mientras mira, la vista pasa al candado con un aviso.
  const hadAccess = useRef<{ roundId: string; value: boolean } | null>(null)
  useEffect(() => {
    if (!roundId || access.data === undefined) return
    if (hadAccess.current?.roundId === roundId && hadAccess.current.value && !access.data) {
      notify('Ya no tienes acceso a esta competencia', 'info')
    }
    hadAccess.current = { roundId, value: access.data }
  }, [roundId, access.data, notify])

  if (isPending || (round && access.isPending)) return <Loading />
  if (isError || access.isError) {
    return (
      <ErrorState
        message="No se pudo cargar la competencia."
        onRetry={() => {
          void refetch()
          void access.refetch()
        }}
      />
    )
  }

  if (!round) {
    return (
      <Notice title="No encontramos esa competencia">
        Puede que se haya borrado. <BackToHub />
      </Notice>
    )
  }

  if (round.cleaned_at) {
    return (
      <Notice title={round.name} icon={<Archive className="h-12 w-12 text-on-night-muted" strokeWidth={2.5} aria-hidden />}>
        Esta competencia se archivó por inactividad. <BackToHub />
      </Notice>
    )
  }

  if (!access.data) return <LockedView round={round} />

  return (
    <>
      <RoundContent round={round} />
      {isMember && <LeaveRound roundId={round.id} />}
    </>
  )
}

/** Contenido de una competencia con acceso, según su estado. */
function RoundContent({ round }: { round: Round }) {
  if (round.status === 'pending') {
    return (
      <Notice title="La competencia todavía no abrió">
        Vuelve cuando la abran. <BackToHub />
      </Notice>
    )
  }

  if (round.status === 'closed') {
    return (
      <div className="flex flex-col gap-8">
        <Notice title="La votación está cerrada">Quien creó la competencia va a elegir al ganador.</Notice>
        <RoundResults roundId={round.id} winnerId={null} />
      </div>
    )
  }

  if (round.status === 'finalized') {
    return (
      <RoundResults
        roundId={round.id}
        winnerId={round.winner_submission_id}
        roundName={round.name}
        finalizedAt={round.finalized_at}
      />
    )
  }

  return <OpenBoard key={round.id} roundId={round.id} />
}
