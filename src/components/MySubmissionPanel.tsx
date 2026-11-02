import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ImageUp, LoaderCircle, Trash2, X } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { useSubmissionDrawer } from '../hooks/useSubmissionDrawer'
import { useToast } from '../hooks/useToast'
import { TITLE_MAX, isValidTitle, type BoardItem } from '../lib/board'
import { ERROR_MESSAGES, errorMessage } from '../lib/errors'
import { ACCEPT_ATTRIBUTE, compressImage, firstImageFile, validateImageFile, type CompressedImage } from '../lib/image'
import { deleteMySubmission, publishSubmission, replaceSubmissionImage, updateSubmissionTitle } from '../lib/submissions'
import ConfirmDialog from './ConfirmDialog'
import UploadDropzone from './UploadDropzone'

interface Draft extends CompressedImage {
  previewUrl: string
}

interface MySubmissionPanelProps {
  roundId: string
  mine: BoardItem | undefined
  imageUrl: string | undefined
  className?: string
  /** Contenedor desplazable del contenido (el cajón lo marca como inert cuando está oculto). */
  contentRef?: RefObject<HTMLDivElement>
  /** Zona de arrastre del cajón, pegada al borde derecho de la tarjeta. */
  grip?: ReactNode
}

/** Valida y comprime un archivo; devuelve null y avisa si no sirve. */
function usePrepareImage() {
  const { notify } = useToast()
  return useCallback(
    async (file: File): Promise<CompressedImage | null> => {
      const invalid = validateImageFile(file)
      if (invalid) {
        notify(ERROR_MESSAGES[invalid], 'error')
        return null
      }
      try {
        return await compressImage(file)
      } catch {
        notify('No se pudo procesar la imagen. Prueba con otra.', 'error')
        return null
      }
    },
    [notify],
  )
}

function TitleInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-label uppercase text-ink">Título</span>
      <span className="relative">
        <input
          className="input pr-20"
          value={value}
          maxLength={TITLE_MAX}
          placeholder="Ponle un título"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary text-ink-muted tabular-nums">
          {value.length}/{TITLE_MAX}
        </span>
      </span>
    </label>
  )
}

function NewSubmission({ roundId }: { roundId: string }) {
  const { session } = useSession()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const prepare = usePrepareImage()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [title, setTitle] = useState('')
  const [processing, setProcessing] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => () => {
    if (draft) URL.revokeObjectURL(draft.previewUrl)
  }, [draft])

  const { setOpen } = useSubmissionDrawer()

  const handleFile = useCallback(
    async (file: File) => {
      setOpen(true)
      setProcessing(true)
      const image = await prepare(file)
      setProcessing(false)
      if (image) setDraft({ ...image, previewUrl: URL.createObjectURL(image.blob) })
    },
    [prepare, setOpen],
  )

  const publish = async () => {
    if (!draft || !session || !isValidTitle(title)) return
    setPublishing(true)
    try {
      await publishSubmission(roundId, session.user.id, title, draft)
      notify('¡Publicado!', 'success')
      setDraft(null)
      setTitle('')
      await queryClient.invalidateQueries({ queryKey: ['board'] })
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {draft ? (
        <div className="relative">
          <img src={draft.previewUrl} alt="Vista previa de tu imagen" className="aspect-card w-full rounded-img object-cover" />
          <button
            type="button"
            className="btn btn-icon btn-secondary absolute right-3 top-3"
            aria-label="Quitar imagen"
            onClick={() => setDraft(null)}
            disabled={publishing}
          >
            <X strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      ) : processing ? (
        <div className="flex aspect-card flex-col items-center justify-center gap-3 rounded-card bg-surface-alt text-ink-muted" role="status">
          <LoaderCircle className="h-12 w-12 animate-spin text-brand-600" strokeWidth={2.5} aria-hidden />
          <span className="text-secondary">Preparando tu imagen…</span>
        </div>
      ) : (
        <UploadDropzone onFile={(file) => void handleFile(file)} />
      )}
      <TitleInput value={title} onChange={setTitle} disabled={publishing} />
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={() => void publish()}
        disabled={!draft || !isValidTitle(title) || publishing}
      >
        {publishing ? 'Publicando…' : 'Publicar'}
      </button>
    </div>
  )
}

function ExistingSubmission({ roundId, mine, imageUrl }: { roundId: string; mine: BoardItem; imageUrl?: string }) {
  const { session } = useSession()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const prepare = usePrepareImage()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState(mine.title)
  const [busy, setBusy] = useState<null | 'title' | 'replace' | 'delete'>(null)
  const [confirm, setConfirm] = useState<null | 'replace' | 'delete'>(null)

  useEffect(() => setTitle(mine.title), [mine.title])

  const refresh = () =>
    Promise.all(
      ['board', 'my_votes', 'vote_details'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
    )

  const saveTitle = async () => {
    setBusy('title')
    try {
      await updateSubmissionTitle(roundId, title)
      notify('Título guardado', 'success')
      await refresh()
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const replace = async (file: File) => {
    if (!session) return
    setBusy('replace')
    try {
      const image = await prepare(file)
      if (!image) return
      await replaceSubmissionImage(roundId, session.user.id, image)
      notify('Imagen reemplazada', 'success')
      await refresh()
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setBusy('delete')
    try {
      await deleteMySubmission(roundId)
      setConfirm(null)
      notify('Publicación borrada', 'success')
      await refresh()
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setBusy(null)
    }
  }

  const askReplace = () => (mine.voteCount > 0 ? setConfirm('replace') : fileRef.current?.click())
  const votesLost = `Vas a perder los ${mine.voteCount} votos recibidos.`
  const titleChanged = title.trim() !== mine.title

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        {imageUrl ? (
          <img src={imageUrl} alt={mine.title} className="aspect-card w-full rounded-img object-cover" />
        ) : (
          <div className="aspect-card w-full rounded-img bg-surface-alt" />
        )}
        <span className="vote-pill absolute bottom-3 right-3" aria-label={`${mine.voteCount} votos recibidos`}>
          {mine.voteCount}
        </span>
        {busy === 'replace' && (
          <div className="absolute inset-0 flex items-center justify-center rounded-img bg-night-900/70" role="status">
            <LoaderCircle className="h-12 w-12 animate-spin text-on-night" strokeWidth={2.5} aria-label="Reemplazando imagen" />
          </div>
        )}
      </div>

      <TitleInput value={title} onChange={setTitle} disabled={busy !== null} />
      {titleChanged && (
        <button
          type="button"
          className="btn btn-primary btn-sm w-full"
          onClick={() => void saveTitle()}
          disabled={!isValidTitle(title) || busy !== null}
        >
          {busy === 'title' ? 'Guardando…' : 'Guardar título'}
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-secondary btn-sm" onClick={askReplace} disabled={busy !== null}>
          <ImageUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Reemplazar
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm('delete')} disabled={busy !== null}>
          <Trash2 className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Borrar
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        aria-label="Elegir la nueva imagen"
        onChange={(event) => {
          const file = firstImageFile(event.target.files)
          event.target.value = ''
          if (file) void replace(file)
        }}
      />

      <ConfirmDialog
        open={confirm === 'replace'}
        title="¿Reemplazar imagen?"
        confirmLabel="Elegir imagen"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          fileRef.current?.click()
        }}
      >
        {votesLost} Los votos vuelven a quienes los dieron.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'delete'}
        title="¿Borrar tu publicación?"
        confirmLabel={busy === 'delete' ? 'Borrando…' : 'Borrar'}
        danger
        pending={busy === 'delete'}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove()}
      >
        {mine.voteCount > 0 ? `${votesLost} ` : ''}Podrás volver a publicar mientras la competencia siga abierta.
      </ConfirmDialog>
    </div>
  )
}

export default function MySubmissionPanel({
  roundId,
  mine,
  imageUrl,
  className = '',
  contentRef,
  grip,
}: MySubmissionPanelProps) {
  return (
    <section className={`card relative flex flex-col ${className}`} aria-labelledby="mi-publicacion">
      {/* Con zona de arrastre, el contenido deja libre el borde derecho (y su barra de scroll no queda debajo). */}
      <div ref={contentRef} className={`flex flex-col gap-4 overflow-y-auto p-4 sm:p-6 ${grip ? 'mr-6 pr-2 sm:pr-2' : ''}`}>
        <h2 id="mi-publicacion" className="section-title">
          Mi publicación
        </h2>
        {mine ? (
          <ExistingSubmission roundId={roundId} mine={mine} imageUrl={imageUrl} />
        ) : (
          <NewSubmission roundId={roundId} />
        )}
      </div>
      {grip}
    </section>
  )
}
