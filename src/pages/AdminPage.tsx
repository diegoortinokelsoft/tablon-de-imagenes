import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Palette, Trash2, Trophy } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import Lightbox from '../components/Lightbox'
import RankingList from '../components/RankingList'
import StatusChip from '../components/StatusChip'
import { useAdminStats } from '../hooks/useAdminStats'
import { useBoard } from '../hooks/useBoard'
import { useCurrentRound, type Round, type RoundStatus } from '../hooks/useCurrentRound'
import { useArchivedRounds } from '../hooks/useHistory'
import { useSignedUrls } from '../hooks/useSignedUrls'
import { useToast } from '../hooks/useToast'
import {
  deleteArchivedRound,
  deleteSubmissionAsAdmin,
  finalizeRound,
  hardReset,
  renameRound,
  setRoundStatus,
  startNewRound,
} from '../lib/admin'
import { tiedPositions, type BoardItem } from '../lib/board'
import { errorMessage } from '../lib/errors'
import { formatDate, suggestNextRoundName } from '../lib/labels'
import { REALTIME_QUERY_KEYS } from '../lib/realtime'

const FILES_WARNING = 'Se borraron los datos, pero no se pudieron borrar algunos archivos de Storage.'

// Botones válidos para cada estado (Abrir, Cerrar, Reabrir).
const STATUS_ACTIONS: Partial<Record<RoundStatus, { label: string; target: RoundStatus; className: string }>> = {
  pending: { label: 'Abrir', target: 'open', className: 'btn-primary' },
  open: { label: 'Cerrar', target: 'closed', className: 'btn-primary' },
  closed: { label: 'Reabrir', target: 'open', className: 'btn-secondary' },
}

/** Ejecuta una acción de admin con estado de carga, toast de error y relectura de los datos. */
function useAdminAction() {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)

  const run = useCallback(
    async (key: string, action: () => Promise<unknown>, success?: string) => {
      setBusy(key)
      try {
        const result = await action()
        if (result && typeof result === 'object' && 'filesOk' in result && !result.filesOk) {
          notify(FILES_WARNING, 'error')
        } else if (success) {
          notify(success, 'success')
        }
        return true
      } catch (error) {
        notify(errorMessage(error), 'error')
        return false
      } finally {
        await Promise.all(REALTIME_QUERY_KEYS.map((k) => queryClient.invalidateQueries({ queryKey: [k] })))
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

function CurrentRoundPanel({ round }: { round: Round }) {
  const { busy, run } = useAdminAction()
  const { data: stats } = useAdminStats(round.id)
  const [name, setName] = useState(round.name)
  const action = STATUS_ACTIONS[round.status]
  const nameChanged = name.trim() !== round.name
  const nameValid = name.trim().length >= 1 && name.trim().length <= 80

  useEffect(() => setName(round.name), [round.name])

  return (
    <Panel title="Competencia actual">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <NameField label="Nombre" value={name} onChange={setName} disabled={busy !== null} />
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!nameChanged || !nameValid || busy !== null}
          onClick={() => void run('rename', () => renameRound(name), 'Nombre guardado')}
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
            onClick={() => void run('status', () => setRoundStatus(action.target))}
          >
            {action.label}
          </button>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {(
          [
            ['Participantes con sesión', stats?.participants],
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

function SubmissionsPanel({ round }: { round: Round }) {
  const { busy, run } = useAdminAction()
  const { data: items = [] } = useBoard(round.id)
  const { data: urls = {} } = useSignedUrls(items.map((item) => item.imagePath))
  const [toDelete, setToDelete] = useState<BoardItem | null>(null)
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [lightbox, setLightbox] = useState<BoardItem | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])

  const choosing = round.status === 'closed'
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
          void run('delete', () => deleteSubmissionAsAdmin(toDelete!.id), 'Publicación borrada').then(() =>
            setToDelete(null),
          )
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
          void run('finalize', () => finalizeRound(winner!.id), '¡Competencia finalizada!').then(() =>
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

function NewRoundPanel({ round }: { round: Round }) {
  const { busy, run } = useAdminAction()
  const [name, setName] = useState(() => suggestNextRoundName(round.name))
  const valid = name.trim().length >= 1

  return (
    <Panel title="Nueva competencia">
      <p className="text-body text-ink-muted">
        Archiva "{round.name}" en el historial, con su ganador y su ranking, y crea una nueva en estado Preparada.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <NameField label="Nombre de la nueva competencia" value={name} onChange={setName} disabled={busy !== null} />
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valid || busy !== null}
          onClick={() => void run('new', () => startNewRound(name), 'Nueva competencia creada')}
        >
          Nueva competencia
        </button>
      </div>
    </Panel>
  )
}

function DangerZone({ round }: { round: Round }) {
  const { busy, run } = useAdminAction()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [name, setName] = useState(round.name)

  const close = () => {
    setOpen(false)
    setConfirmText('')
  }

  return (
    <Panel title="Zona de peligro" tone="danger">
      <p className="text-body text-ink-muted">
        El reinicio total borra definitivamente "{round.name}" con todas sus publicaciones, votos e imágenes, sin dejar
        historial, y crea una competencia nueva en estado Preparada.
      </p>
      <button type="button" className="btn btn-danger self-start" disabled={busy !== null} onClick={() => setOpen(true)}>
        Reinicio total
      </button>
      <ConfirmDialog
        open={open}
        title="Reinicio total"
        confirmLabel={busy === 'reset' ? 'Borrando…' : 'Borrar todo'}
        danger
        pending={busy === 'reset'}
        confirmDisabled={confirmText !== 'BORRAR' || name.trim().length === 0}
        onCancel={close}
        onConfirm={() => void run('reset', () => hardReset(name), 'Competencia reiniciada').then(close)}
      >
        <div className="flex flex-col gap-4">
          <p>Esta acción no se puede deshacer.</p>
          <NameField label="Nombre de la nueva competencia" value={name} onChange={setName} />
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

function HistoryPanel() {
  const { busy, run } = useAdminAction()
  const { data: rounds = [] } = useArchivedRounds()
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)

  return (
    <Panel title="Historial">
      {rounds.length === 0 ? (
        <p className="text-body text-ink-muted">Todavía no hay competencias archivadas.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rounds.map((archived) => (
            <li key={archived.id} className="flex flex-wrap items-center gap-3 rounded-btn bg-surface-alt p-3">
              <Link to={`/historial/${archived.id}`} className="min-w-0 flex-1 text-card-title text-brand-600 hover:underline">
                {archived.name}
              </Link>
              <span className="text-secondary text-ink-muted">Finalizada el {formatDate(archived.finalized_at)}</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={busy !== null}
                onClick={() => setToDelete(archived)}
              >
                Eliminar del historial
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title="¿Eliminar del historial?"
        confirmLabel={busy === 'archive' ? 'Eliminando…' : 'Eliminar'}
        danger
        pending={busy === 'archive'}
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          void run('archive', () => deleteArchivedRound(toDelete!.id), 'Competencia eliminada del historial').then(() =>
            setToDelete(null),
          )
        }
      >
        Se borrarán definitivamente "{toDelete?.name}", sus publicaciones, votos e imágenes.
      </ConfirmDialog>
    </Panel>
  )
}

export default function AdminPage() {
  const { data: round } = useCurrentRound()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Administración</h1>
        <Link to="/estilos" className="flex items-center gap-2 text-secondary uppercase text-on-night-muted hover:text-on-night">
          <Palette className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Guía de estilo
        </Link>
      </div>
      {round && (
        <>
          <CurrentRoundPanel key={`${round.id}-current`} round={round} />
          {round.status === 'finalized' && <NewRoundPanel key={`${round.id}-new`} round={round} />}
          <SubmissionsPanel key={`${round.id}-subs`} round={round} />
          <DangerZone key={`${round.id}-danger`} round={round} />
        </>
      )}
      <HistoryPanel />
    </div>
  )
}
