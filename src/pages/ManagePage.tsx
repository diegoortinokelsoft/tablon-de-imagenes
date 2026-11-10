import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Check, Copy, Globe, Lock, RefreshCw, Search, Trash2, Trophy, UserPlus, X } from 'lucide-react'
import Avatar from '../components/Avatar'
import ConfirmDialog from '../components/ConfirmDialog'
import Lightbox from '../components/Lightbox'
import RankingList from '../components/RankingList'
import { ErrorState, Loading } from '../components/StateMessages'
import StatusChip from '../components/StatusChip'
import { useBoard } from '../hooks/useBoard'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useImportSources, useInviteToken, useMembers, usePendingRequests, useProfileSearch, type Person } from '../hooks/useMembers'
import { useRoundRealtime } from '../hooks/useRealtime'
import { useRound, useRoundStats, type Round, type RoundStatus } from '../hooks/useRound'
import { useSession } from '../hooks/useSession'
import { useSignedUrls } from '../hooks/useSignedUrls'
import { useToast } from '../hooks/useToast'
import { tiedPositions, type BoardItem } from '../lib/board'
import { errorMessage } from '../lib/errors'
import { STATUS_LABELS, VISIBILITY_LABELS, importedMembersMessage, memberCountLabel, type RoundVisibility } from '../lib/labels'
import { addMember, importMembers, inviteUrl, regenerateInviteToken, removeMember, resolveAccessRequest } from '../lib/members'
import { HUB_QUERY_KEYS, ROUND_QUERY_KEYS } from '../lib/realtime'
import { deleteRound, deleteSubmission, finalizeRound, renameRound, setRoundStatus, setRoundVisibility } from '../lib/rounds'

const FILES_WARNING = 'Se borraron los datos, pero no se pudieron borrar algunos archivos de Storage.'

// Botones válidos para cada estado (Abrir, Cerrar, Reabrir).
const STATUS_ACTIONS: Partial<Record<RoundStatus, { label: string; target: RoundStatus; className: string }>> = {
  pending: { label: 'Abrir', target: 'open', className: 'btn-primary' },
  open: { label: 'Cerrar', target: 'closed', className: 'btn-primary' },
  closed: { label: 'Reabrir', target: 'open', className: 'btn-secondary' },
}

const VISIBILITY_HINTS: Record<RoundVisibility, string> = {
  public: 'Cualquier persona de Kelsoft la ve y participa.',
  private: 'Solo la ven y participan quienes tienen acceso.',
}

/** Mensaje de éxito: un texto fijo (toast de éxito) o uno que depende del resultado de la acción. */
type SuccessMessage<T> = string | ((result: T) => { message: string; type: 'success' | 'info' })

/** Ejecuta una acción del dueño con estado de carga, toast de error y relectura de los datos. */
function useManageAction() {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const run = useCallback(
    async <T,>(key: string, action: () => Promise<T>, success?: SuccessMessage<T>) => {
      setBusy(key)
      try {
        const result = await action()
        if (result && typeof result === 'object' && 'filesOk' in result && !result.filesOk) {
          notify(FILES_WARNING, 'error')
        } else if (typeof success === 'function') {
          const { message, type } = success(result)
          notify(message, type)
        } else if (success) {
          notify(success, 'success')
        }
        return true
      } catch (error) {
        notify(errorMessage(error), 'error')
        return false
      } finally {
        await Promise.all(
          [...ROUND_QUERY_KEYS, ...HUB_QUERY_KEYS, 'profile_search'].map((k) =>
            queryClient.invalidateQueries({ queryKey: [k] }),
          ),
        )
        setBusy(null)
      }
    },
    [notify, queryClient],
  )

  return { busy, run }
}

function Panel({ title, children, tone = 'default' }: { title: string; children: ReactNode; tone?: 'default' | 'danger' }) {
  const id = `panel-${title.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section className={`card flex flex-col gap-4 p-4 sm:p-6 ${tone === 'danger' ? 'border-danger' : ''}`} aria-labelledby={id}>
      <h2 id={id} className="section-title">
        {title}
      </h2>
      {children}
    </section>
  )
}

function NameField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="flex flex-1 flex-col gap-2">
      <span className="text-label uppercase">{label}</span>
      <span className="relative">
        <input
          className="input pr-20"
          value={value}
          maxLength={80}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary tabular-nums text-ink-muted">
          {value.length}/80
        </span>
      </span>
    </label>
  )
}

function RoundPanel({ round }: { round: Round }) {
  const { busy, run } = useManageAction()
  const { data: stats } = useRoundStats(round.id)
  const [name, setName] = useState(round.name)
  const action = STATUS_ACTIONS[round.status]
  const nameChanged = name.trim() !== round.name
  const nameValid = name.trim().length >= 1 && name.trim().length <= 80
  const visibilityLocked = round.status !== 'pending'

  useEffect(() => setName(round.name), [round.name])

  return (
    <Panel title="Competencia">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <NameField label="Nombre" value={name} onChange={setName} disabled={busy !== null} />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!nameChanged || !nameValid || busy !== null}
          onClick={() => void run('rename', () => renameRound(round.id, name), 'Nombre guardado')}
        >
          Guardar nombre
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-label uppercase text-ink-muted">Estado</span>
        <StatusChip status={round.status} />
        {action && (
          <button
            type="button"
            className={`btn btn-sm ${action.className}`}
            disabled={busy !== null}
            onClick={() => void run('status', () => setRoundStatus(round.id, action.target))}
          >
            {action.label}
          </button>
        )}
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="pb-2 text-label uppercase text-ink-muted">Visibilidad</legend>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(['public', 'private'] as const).map((visibility) => {
            const Icon = visibility === 'public' ? Globe : Lock
            const checked = round.visibility === visibility
            return (
              <label
                key={visibility}
                className={`flex flex-1 items-start gap-3 rounded-btn border-3 p-3 ${
                  checked ? 'border-brand-600 bg-surface-alt' : 'border-ink'
                } ${visibilityLocked ? 'opacity-45' : 'cursor-pointer'}`}
              >
                <input
                  type="radio"
                  name="visibilidad"
                  className="mt-1 h-5 w-5 accent-brand-600"
                  checked={checked}
                  disabled={visibilityLocked || busy !== null}
                  onChange={() =>
                    void run('visibility', () => setRoundVisibility(round.id, visibility), 'Visibilidad guardada')
                  }
                />
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-body">
                    <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    {VISIBILITY_LABELS[visibility]}
                  </span>
                  <span className="text-secondary text-ink-muted">{VISIBILITY_HINTS[visibility]}</span>
                </span>
              </label>
            )
          })}
        </div>
        {visibilityLocked && (
          <p className="text-secondary text-ink-muted">
            La visibilidad solo se cambia antes de abrir la competencia, para que nadie que ya votó pierda el acceso.
          </p>
        )}
      </fieldset>
      <dl className="grid grid-cols-3 gap-3">
        {(
          [
            ['Participantes', stats?.participants],
            ['Publicaciones', stats?.submissions],
            ['Votos emitidos', stats?.votes],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 rounded-btn bg-surface-alt p-3">
            <dt className="text-label uppercase text-ink-muted">{label}</dt>
            <dd className="font-display text-vote-card tabular-nums">{value ?? '–'}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  )
}

/** Publicaciones con "Borrar". El dueño además elige al ganador con la competencia cerrada (canFinalize). */
function SubmissionsPanel({ round, canFinalize }: { round: Round; canFinalize: boolean }) {
  const { busy, run } = useManageAction()
  const { data: items = [] } = useBoard(round.id)
  const { data: urls = {} } = useSignedUrls(items.map((item) => item.imagePath))
  const [toDelete, setToDelete] = useState<BoardItem | null>(null)
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [lightbox, setLightbox] = useState<BoardItem | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])

  const choosing = canFinalize && round.status === 'closed'
  const tieAtTop = tiedPositions(items).has(1)
  const winner = items.find((item) => item.id === winnerId)

  useEffect(() => {
    if (winnerId && !items.some((item) => item.id === winnerId)) setWinnerId(null)
  }, [items, winnerId])

  return (
    <Panel title="Publicaciones">
      {choosing && (
        <p className="text-body text-ink-muted">
          Elige la publicación ganadora y pulsa "Finalizar competencia". Puedes elegir cualquiera.
        </p>
      )}
      {choosing && tieAtTop && (
        <p role="alert" className="flex items-center gap-2 rounded-btn border-3 border-sun bg-surface-alt p-3 text-secondary">
          <AlertTriangle className="h-5 w-5 shrink-0 text-ink" strokeWidth={2.5} aria-hidden />
          Hay empate en el primer puesto. La elección es libre.
        </p>
      )}
      {items.length === 0 ? (
        <p className="text-body text-ink-muted">Todavía no hay publicaciones.</p>
      ) : (
        <RankingList
          items={items}
          urls={urls}
          onOpen={setLightbox}
          renderExtra={(item) => (
            <div className="flex shrink-0 items-center gap-2">
              {choosing && (
                <label className="flex cursor-pointer items-center gap-2 text-label uppercase">
                  <input
                    type="radio"
                    name="ganador"
                    className="h-5 w-5 accent-brand-600"
                    checked={winnerId === item.id}
                    onChange={() => setWinnerId(item.id)}
                  />
                  <span className="hidden md:inline">Ganador</span>
                </label>
              )}
              <button
                type="button"
                className="btn btn-icon btn-danger"
                aria-label={`Borrar "${item.title}"`}
                disabled={busy !== null}
                onClick={() => setToDelete(item)}
              >
                <Trash2 strokeWidth={2.5} aria-hidden />
              </button>
            </div>
          )}
        />
      )}
      {choosing && (
        <button
          type="button"
          className="btn btn-primary self-start"
          disabled={!winner || busy !== null}
          onClick={() => setConfirmFinalize(true)}
        >
          <Trophy className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Finalizar competencia
        </button>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="¿Borrar publicación?"
        confirmLabel={busy === 'delete' ? 'Borrando…' : 'Borrar'}
        danger
        pending={busy === 'delete'}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          void run('delete', () => deleteSubmission(toDelete!.id), 'Publicación borrada').then(() => setToDelete(null))
        }
      >
        Se borrará "{toDelete?.title}" de {toDelete?.authorName}
        {toDelete && toDelete.voteCount > 0 ? ` y sus ${toDelete.voteCount} votos volverán a quienes los dieron` : ''}.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmFinalize}
        title="¿Finalizar competencia?"
        confirmLabel={busy === 'finalize' ? 'Finalizando…' : 'Finalizar'}
        pending={busy === 'finalize'}
        onCancel={() => setConfirmFinalize(false)}
        onConfirm={() =>
          void run('finalize', () => finalizeRound(round.id, winner!.id), '¡Competencia finalizada!').then(() =>
            setConfirmFinalize(false),
          )
        }
      >
        El ganador será "{winner?.title}" de {winner?.authorName}. Todos lo verán destacado.
      </ConfirmDialog>
      {lightbox && urls[lightbox.imagePath] && (
        <Lightbox src={urls[lightbox.imagePath]!} title={lightbox.title} author={lightbox.authorName} onClose={closeLightbox} />
      )}
    </Panel>
  )
}

const SOURCE_LABELS = {
  invite_link: 'Con enlace',
  added: 'Agregado por ti',
  request: 'Por solicitud',
} as const

function PersonRow({ person, children }: { person: Person; children?: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-btn bg-surface-alt p-3">
      <Avatar name={person.name} url={person.avatar} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body">{person.name}</span>
        <span className="truncate text-secondary text-ink-muted">{person.email}</span>
      </span>
      {children}
    </li>
  )
}

function InviteLink({ round }: { round: Round }) {
  const { busy, run } = useManageAction()
  const { notify } = useToast()
  const { data: token } = useInviteToken(round.id)
  const [confirming, setConfirming] = useState(false)
  const url = token ? inviteUrl(token) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      notify('Enlace copiado', 'success')
    } catch {
      notify('No se pudo copiar. Selecciona el enlace y cópialo a mano.', 'error')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label uppercase">Enlace de invitación</span>
      <p className="text-secondary text-ink-muted">Quien lo abra entra sin pasar por tu aprobación.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input min-w-0 flex-1 text-secondary" value={url} readOnly aria-label="Enlace de invitación" />
        <button type="button" className="btn btn-secondary" disabled={!url} onClick={() => void copy()}>
          <Copy className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Copiar
        </button>
        <button
          type="button"
          className="btn btn-icon btn-secondary"
          aria-label="Generar nuevo enlace"
          title="Generar nuevo enlace"
          disabled={busy !== null}
          onClick={() => setConfirming(true)}
        >
          <RefreshCw strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="¿Generar un enlace nuevo?"
        confirmLabel={busy === 'regenerate' ? 'Generando…' : 'Generar'}
        pending={busy === 'regenerate'}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          void run('regenerate', () => regenerateInviteToken(round.id), 'Enlace nuevo generado').then(() =>
            setConfirming(false),
          )
        }
      >
        El enlace anterior dejará de funcionar. Quienes ya entraron siguen siendo miembros.
      </ConfirmDialog>
    </div>
  )
}

function AddMember({ round, memberIds }: { round: Round; memberIds: Set<string> }) {
  const { busy, run } = useManageAction()
  const [search, setSearch] = useState('')
  const { data: results = [], isFetching } = useProfileSearch(search)
  const candidates = results.filter((person) => person.id !== round.owner_id && !memberIds.has(person.id))

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className="text-label uppercase">Agregar persona</span>
        <span className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
            strokeWidth={2.5}
            aria-hidden
          />
          <input
            className="input pl-12"
            type="search"
            placeholder="Nombre o email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </span>
      </label>
      <p className="text-secondary text-ink-muted">Aparecen quienes ya iniciaron sesión alguna vez en el Tablón.</p>
      {search.trim().length >= 2 && (
        <ul className="flex flex-col gap-2">
          {candidates.map((person) => (
            <PersonRow key={person.id} person={person}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy !== null}
                onClick={() => void run(`add-${person.id}`, () => addMember(round.id, person.id), `${person.name} ya es miembro`)}
              >
                <UserPlus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Agregar
              </button>
            </PersonRow>
          ))}
          {!isFetching && candidates.length === 0 && (
            <li className="text-secondary text-ink-muted">No encontramos a nadie más con ese nombre o email.</li>
          )}
        </ul>
      )}
    </div>
  )
}

function ImportMembers({ round }: { round: Round }) {
  const { busy, run } = useManageAction()
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const { data: sources, isLoading, error } = useImportSources(round, open)
  const hasCandidates = (sources ?? []).some((source) => source.memberCount > 0)

  // Si la opción elegida desaparece o se queda sin miembros al releerse, se descarta la elección.
  if (sourceId && sources && !sources.some((source) => source.id === sourceId && source.memberCount > 0)) {
    setSourceId(null)
  }

  const close = () => {
    setOpen(false)
    setSourceId(null)
  }

  const confirm = () => {
    if (!sourceId) return
    void run(
      'import',
      () => importMembers(round.id, sourceId),
      (count) => ({ message: importedMembersMessage(count), type: count > 0 ? 'success' : 'info' }),
    ).then((ok) => {
      if (ok) close()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn btn-secondary self-start" disabled={busy !== null} onClick={() => setOpen(true)}>
        Importar de otra competencia
      </button>
      <ConfirmDialog
        open={open}
        title="Importar miembros"
        confirmLabel={busy === 'import' ? 'Importando…' : 'Importar'}
        pending={busy === 'import'}
        confirmDisabled={!sourceId}
        onCancel={close}
        onConfirm={confirm}
      >
        <span className="flex flex-col gap-4">
          <span>Elige una de tus competencias privadas. Sus miembros se sumarán a esta; quienes ya son miembros no se repiten.</span>
          {isLoading ? (
            <span className="text-ink-muted">Cargando…</span>
          ) : error ? (
            <span role="alert">{errorMessage(error)}</span>
          ) : !hasCandidates ? (
            <span className="text-ink-muted">No tienes otras competencias privadas con miembros</span>
          ) : (
            <span role="radiogroup" aria-label="Competencia de origen" className="flex flex-col gap-2">
              {sources!.map((source) => {
                const empty = source.memberCount === 0
                const checked = sourceId === source.id
                return (
                  <label
                    key={source.id}
                    className={`flex items-center gap-3 rounded-btn border-3 p-3 ${
                      checked ? 'border-brand-600 bg-surface-alt' : 'border-ink'
                    } ${empty ? 'opacity-45' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="origen-importacion"
                      className="h-5 w-5 shrink-0 accent-brand-600"
                      checked={checked}
                      disabled={empty || busy !== null}
                      onChange={() => setSourceId(source.id)}
                    />
                    <span className="min-w-0 text-body text-ink">
                      {source.name} · {STATUS_LABELS[source.status]} · {memberCountLabel(source.memberCount)}
                    </span>
                  </label>
                )
              })}
            </span>
          )}
        </span>
      </ConfirmDialog>
    </div>
  )
}

function MembersPanel({ round }: { round: Round }) {
  const { busy, run } = useManageAction()
  const { data: members = [] } = useMembers(round.id)
  const [toRemove, setToRemove] = useState<Person | null>(null)
  const memberIds = new Set(members.map((member) => member.id))

  return (
    <Panel title="Miembros">
      <InviteLink round={round} />
      <AddMember round={round} memberIds={memberIds} />
      <ImportMembers round={round} />
      <div className="flex flex-col gap-2">
        <span className="text-label uppercase">{memberCountLabel(members.length)}</span>
        {members.length === 0 ? (
          <p className="text-secondary text-ink-muted">Todavía no hay miembros: comparte el enlace o agrega personas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <PersonRow key={member.id} person={member}>
                <span className="chip chip-pending">{SOURCE_LABELS[member.source]}</span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy !== null}
                  onClick={() => setToRemove(member)}
                >
                  Quitar
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={toRemove !== null}
        title="¿Quitar miembro?"
        confirmLabel={busy === 'remove' ? 'Quitando…' : 'Quitar'}
        danger
        pending={busy === 'remove'}
        onCancel={() => setToRemove(null)}
        onConfirm={() =>
          void run('remove', () => removeMember(round.id, toRemove!.id), 'Miembro quitado').then(() => setToRemove(null))
        }
      >
        {toRemove?.name} pierde el acceso. Se borrarán su publicación y sus votos, y los votos que recibió vuelven a
        quienes los dieron.
      </ConfirmDialog>
    </Panel>
  )
}

function RequestsPanel({ round }: { round: Round }) {
  const { busy, run } = useManageAction()
  const { data: requests = [] } = usePendingRequests(round.id)

  return (
    <Panel title="Solicitudes">
      {requests.length === 0 ? (
        <p className="text-body text-ink-muted">No hay solicitudes pendientes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((request) => (
            <PersonRow key={request.requestId} person={request}>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`approve-${request.requestId}`, () => resolveAccessRequest(request.requestId, true), 'Solicitud aprobada')
                  }
                >
                  <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  Aprobar
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(`reject-${request.requestId}`, () => resolveAccessRequest(request.requestId, false), 'Solicitud rechazada')
                  }
                >
                  <X className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  Rechazar
                </button>
              </div>
            </PersonRow>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function DangerZone({ round }: { round: Round }) {
  const { busy, run } = useManageAction()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const close = () => {
    setOpen(false)
    setConfirmText('')
  }

  return (
    <Panel title="Zona de peligro" tone="danger">
      <p className="text-body text-ink-muted">
        Borrar la competencia elimina definitivamente "{round.name}" con todas sus publicaciones, votos e imágenes, y
        libera el cupo de competencias activas de quien la creó.
      </p>
      <button type="button" className="btn btn-danger self-start" disabled={busy !== null} onClick={() => setOpen(true)}>
        Borrar competencia
      </button>
      <ConfirmDialog
        open={open}
        title="Borrar competencia"
        confirmLabel={busy === 'delete-round' ? 'Borrando…' : 'Borrar todo'}
        danger
        pending={busy === 'delete-round'}
        confirmDisabled={confirmText !== 'BORRAR'}
        onCancel={close}
        onConfirm={() =>
          void run('delete-round', () => deleteRound(round.id), 'Competencia borrada').then((ok) => {
            close()
            if (ok) navigate('/', { replace: true })
          })
        }
      >
        <div className="flex flex-col gap-4">
          <p>Esta acción no se puede deshacer.</p>
          <label className="flex flex-col gap-2">
            <span className="text-label uppercase text-ink">Escribe BORRAR para confirmar</span>
            <input
              className="input"
              value={confirmText}
              autoComplete="off"
              onChange={(event) => setConfirmText(event.target.value)}
            />
          </label>
        </div>
      </ConfirmDialog>
    </Panel>
  )
}

export default function ManagePage() {
  const { roundId } = useParams()
  const { session } = useSession()
  const { data: round, isPending, isError, refetch } = useRound(roundId)
  const { isAdmin, loading: adminLoading } = useIsAdmin()
  useRoundRealtime(roundId)

  if (isPending || adminLoading) return <Loading />
  if (isError) return <ErrorState message="No se pudo cargar la competencia." onRetry={() => void refetch()} />
  // El dueño gestiona todo; el superadmin solo modera (borrar publicaciones o la competencia).
  // Los demás vuelven a la competencia. Las RPC lo verifican igual.
  const isOwner = round?.owner_id === session?.user.id
  if (!round || (!isOwner && !isAdmin) || round.cleaned_at) {
    return <Navigate to={roundId ? `/c/${roundId}` : '/'} replace />
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          to={`/c/${round.id}`}
          className="flex items-center gap-2 self-start text-secondary uppercase text-on-night-muted hover:text-on-night"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Ver competencia
        </Link>
        <h1 className="page-title">{isOwner ? 'Gestionar' : 'Moderar'}</h1>
      </div>
      {isOwner && <RoundPanel key={`${round.id}-round`} round={round} />}
      {isOwner && round.visibility === 'private' && (
        <>
          <RequestsPanel key={`${round.id}-requests`} round={round} />
          <MembersPanel key={`${round.id}-members`} round={round} />
        </>
      )}
      <SubmissionsPanel key={`${round.id}-subs`} round={round} canFinalize={isOwner} />
      <DangerZone key={`${round.id}-danger`} round={round} />
    </div>
  )
}
