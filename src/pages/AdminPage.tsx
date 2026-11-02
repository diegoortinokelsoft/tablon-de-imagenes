import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, Check, CloudUpload, Download, ExternalLink, Lock, Palette, Trash2 } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import { ErrorState, Loading } from '../components/StateMessages'
import StatusChip from '../components/StatusChip'
import { useHub } from '../hooks/useHub'
import { useToast } from '../hooks/useToast'
import { cleanRound, fetchArchives, fetchRoundsToArchive, markExported } from '../lib/admin'
import { getDriveToken, loadGis, uploadToDrive } from '../lib/drive'
import { env } from '../lib/env'
import { errorCode, errorMessage } from '../lib/errors'
import { buildRoundExport, exportFilename } from '../lib/exportZip'
import { formatDate } from '../lib/labels'
import { downloadBlob } from '../lib/resultImage'
import { deleteRound } from '../lib/rounds'
import { supabase } from '../lib/supabase'

const FILES_WARNING = 'Se borraron los datos, pero no se pudieron borrar algunos archivos de Storage.'
const ADMIN_KEYS = ['hub', 'admin_to_archive', 'admin_archives']

function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `panel-${title.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <section className="card flex flex-col gap-4 p-4 sm:p-6" aria-labelledby={id}>
      <div className="flex flex-col gap-1">
        <h2 id={id} className="section-title">
          {title}
        </h2>
        {description && <p className="text-body text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function useRefreshAdmin() {
  const queryClient = useQueryClient()
  return () => Promise.all(ADMIN_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
}

/** Datos de la competencia que necesita el ZIP (ganador y fecha de finalización). */
async function fetchExportRound(roundId: string) {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, name, status, winner_submission_id, finalized_at')
    .eq('id', roundId)
    .single()
  if (error) throw error
  return data
}

type ToArchive = Awaited<ReturnType<typeof fetchRoundsToArchive>>[number]

function ArchiveRow({ round }: { round: ToArchive }) {
  const { notify } = useToast()
  const refresh = useRefreshAdmin()
  const [step, setStep] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)
  const [confirmClean, setConfirmClean] = useState(false)
  const busy = step !== null
  const exported = !!round.exported_at

  const run = async (label: string, action: () => Promise<unknown>) => {
    setStep(label)
    try {
      await action()
    } catch (error) {
      // Los errores de RPC traen un código; los de Drive o del ZIP, un mensaje propio en español.
      notify(errorCode(error) || !(error instanceof Error) ? errorMessage(error) : error.message, 'error')
    } finally {
      await refresh()
      setStep(null)
    }
  }

  const exportToDrive = () =>
    run('Pidiendo permiso a Google…', async () => {
      // El permiso se pide primero, dentro del clic, para que el navegador no bloquee la ventana de Google.
      const token = await getDriveToken(env.googleClientId!)
      setStep('Armando el ZIP…')
      const blob = await buildRoundExport(await fetchExportRound(round.id))
      setStep('Subiendo a Drive…')
      const link = await uploadToDrive(token, blob, exportFilename(round.name))
      await markExported(round.id, link)
      notify('Exportada a Drive', 'success')
    })

  const download = () =>
    run('Armando el ZIP…', async () => {
      const blob = await buildRoundExport(await fetchExportRound(round.id))
      downloadBlob(blob, exportFilename(round.name))
      setDownloaded(true)
    })

  const clean = () =>
    run('Limpiando…', async () => {
      const result = await cleanRound(round.id)
      notify(result.filesOk ? 'Competencia archivada' : FILES_WARNING, result.filesOk ? 'success' : 'error')
      setConfirmClean(false)
    })

  return (
    <li className="flex flex-col gap-3 rounded-btn bg-surface-alt p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link to={`/c/${round.id}`} className="min-w-0 flex-1 truncate text-card-title text-brand-600 hover:underline">
          {round.name}
        </Link>
        {round.visibility === 'private' && <Lock className="h-4 w-4 text-brand-600" strokeWidth={2.5} aria-label="Privada" />}
        <StatusChip status={round.status} />
      </div>
      <p className="text-secondary text-ink-muted">
        De {round.owner_name} · sin actividad desde el {formatDate(round.last_activity_at)} ·{' '}
        {round.submission_count === 1 ? '1 publicación' : `${round.submission_count} publicaciones`}
      </p>
      {exported && (
        <p className="flex flex-wrap items-center gap-2 text-secondary">
          <Check className="h-4 w-4 text-ink" strokeWidth={2.5} aria-hidden />
          Exportada el {formatDate(round.exported_at)}
          {round.drive_url ? (
            <a href={round.drive_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 underline">
              Abrir en Drive
              <ExternalLink className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </a>
          ) : (
            '(guardada a mano)'
          )}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {env.googleClientId && (
          <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void exportToDrive()}>
            <CloudUpload className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Exportar a Drive
          </button>
        )}
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void download()}>
          <Download className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Descargar ZIP
        </button>
        {downloaded && !exported && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => void run('Registrando…', () => markExported(round.id, null))}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            Ya lo guardé
          </button>
        )}
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={busy || !exported}
          title={exported ? undefined : 'Primero exporta la competencia'}
          onClick={() => setConfirmClean(true)}
        >
          <Archive className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Limpiar
        </button>
        {step && (
          <span className="text-secondary text-ink-muted" role="status">
            {step}
          </span>
        )}
      </div>
      <ConfirmDialog
        open={confirmClean}
        title="¿Limpiar la competencia?"
        confirmLabel={step === 'Limpiando…' ? 'Limpiando…' : 'Limpiar'}
        danger
        pending={step === 'Limpiando…'}
        onCancel={() => setConfirmClean(false)}
        onConfirm={() => void clean()}
      >
        Se borrarán las imágenes, publicaciones y votos de "{round.name}". En el hub queda como "Archivada" con su
        ganador y su ranking en texto. La copia completa es la exportación.
      </ConfirmDialog>
    </li>
  )
}

function ToArchivePanel() {
  const { data: rounds = [], isPending, isError, refetch } = useQuery({
    queryKey: ['admin_to_archive'],
    queryFn: fetchRoundsToArchive,
  })
  const total = rounds.reduce((sum, round) => sum + round.submission_count, 0)

  return (
    <Panel
      title="Para archivar"
      description="Competencias con más de 60 días sin actividad. Exporta cada una (a Drive o descargando el ZIP) y después límpiala para liberar espacio."
    >
      {!env.googleClientId && (
        <p className="rounded-btn border-3 border-sun bg-surface-alt p-3 text-secondary">
          Falta configurar VITE_GOOGLE_CLIENT_ID: por ahora solo se puede descargar el ZIP.
        </p>
      )}
      {isPending ? (
        <p className="text-body text-ink-muted">Cargando…</p>
      ) : isError ? (
        <button type="button" className="btn btn-secondary btn-sm self-start" onClick={() => void refetch()}>
          Reintentar
        </button>
      ) : rounds.length === 0 ? (
        <p className="text-body text-ink-muted">No hay competencias para archivar.</p>
      ) : (
        <>
          <p className="text-secondary text-ink-muted">
            {rounds.length === 1 ? '1 competencia' : `${rounds.length} competencias`} esperan, con unas {total}{' '}
            imágenes (alrededor de {total} MB).
          </p>
          <ul className="flex flex-col gap-3">
            {rounds.map((round) => (
              <ArchiveRow key={round.id} round={round} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

function ArchivesPanel() {
  const { data: archives = [], isPending } = useQuery({ queryKey: ['admin_archives'], queryFn: fetchArchives })

  return (
    <Panel title="Archivadas" description="Competencias limpiadas, con el enlace a su exportación.">
      {isPending ? (
        <p className="text-body text-ink-muted">Cargando…</p>
      ) : archives.length === 0 ? (
        <p className="text-body text-ink-muted">Todavía no se archivó ninguna competencia.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {archives.map((archive) => (
            <li key={archive.id} className="flex flex-wrap items-center gap-3 rounded-btn bg-surface-alt p-3">
              <Link to={`/c/${archive.id}`} className="min-w-0 flex-1 truncate text-card-title text-brand-600 hover:underline">
                {archive.name}
              </Link>
              <span className="text-secondary text-ink-muted">
                De {archive.owner_name} · archivada el {formatDate(archive.cleaned_at)}
              </span>
              {archive.drive_url ? (
                <a
                  href={archive.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-secondary text-brand-600 underline"
                >
                  Abrir en Drive
                  <ExternalLink className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                </a>
              ) : (
                <span className="text-secondary text-ink-muted">Guardada a mano</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function AllRoundsPanel() {
  const { notify } = useToast()
  const refresh = useRefreshAdmin()
  const { data: rounds = [], isPending, isError, refetch } = useHub()
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const sorted = [...rounds].sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at))

  const close = () => {
    setToDelete(null)
    setConfirmText('')
  }

  const remove = async () => {
    if (!toDelete) return
    setDeleting(true)
    try {
      const result = await deleteRound(toDelete.id)
      notify(result.filesOk ? 'Competencia borrada' : FILES_WARNING, result.filesOk ? 'success' : 'error')
      close()
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      await refresh()
      setDeleting(false)
    }
  }

  return (
    <Panel
      title="Todas las competencias"
      description='Para moderar publicaciones, entra a la competencia y usa "Moderar" en el encabezado.'
    >
      {isPending ? (
        <Loading />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((round) => (
            <li key={round.id} className="flex flex-wrap items-center gap-3 rounded-btn bg-surface-alt p-3">
              <Link to={`/c/${round.id}`} className="min-w-0 flex-1 truncate text-card-title text-brand-600 hover:underline">
                {round.name}
              </Link>
              {round.visibility === 'private' && <Lock className="h-4 w-4 text-brand-600" strokeWidth={2.5} aria-label="Privada" />}
              {round.cleaned_at ? <span className="chip chip-pending">Archivada</span> : <StatusChip status={round.status} />}
              <span className="text-secondary text-ink-muted">
                {round.owner_name} · {formatDate(round.last_activity_at)}
              </span>
              <button
                type="button"
                className="btn btn-icon btn-danger"
                aria-label={`Borrar "${round.name}"`}
                onClick={() => setToDelete({ id: round.id, name: round.name })}
              >
                <Trash2 strokeWidth={2.5} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={toDelete !== null}
        title="Borrar competencia"
        confirmLabel={deleting ? 'Borrando…' : 'Borrar todo'}
        danger
        pending={deleting}
        confirmDisabled={confirmText !== 'BORRAR'}
        onCancel={close}
        onConfirm={() => void remove()}
      >
        <div className="flex flex-col gap-4">
          <p>
            Se borrarán definitivamente "{toDelete?.name}", sus publicaciones, votos, miembros e imágenes. Esta acción no
            se puede deshacer.
          </p>
          <label className="flex flex-col gap-2">
            <span className="text-label uppercase text-ink">Escribe BORRAR para confirmar</span>
            <input className="input" value={confirmText} autoComplete="off" onChange={(event) => setConfirmText(event.target.value)} />
          </label>
        </div>
      </ConfirmDialog>
    </Panel>
  )
}

export default function AdminPage() {
  // Precarga el script de Google para que el permiso de Drive se pida sin demoras dentro del clic.
  useEffect(() => {
    if (env.googleClientId) void loadGis().catch(() => undefined)
  }, [])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Administración</h1>
        <Link to="/estilos" className="flex items-center gap-2 text-secondary uppercase text-on-night-muted hover:text-on-night">
          <Palette className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Guía de estilo
        </Link>
      </div>
      <ToArchivePanel />
      <ArchivesPanel />
      <AllRoundsPanel />
    </div>
  )
}
