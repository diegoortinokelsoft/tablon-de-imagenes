import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Download, LoaderCircle } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'
import { useToast } from '../hooks/useToast'
import type { Podium } from '../lib/podium'
import {
  RESULT_HEIGHT,
  RESULT_WIDTH,
  canCopyImages,
  copyImage,
  downloadBlob,
  renderResultImage,
  resultFilename,
} from '../lib/resultImage'

interface ShareResultDialogProps {
  roundName: string
  finalizedAt: string | null
  podium: Podium
  winnerImageUrl: string | undefined
  onClose: () => void
}

/** Vista previa de la imagen del resultado, con "Copiar imagen" (para pegar en Slack) y "Descargar". */
export default function ShareResultDialog({ roundName, finalizedAt, podium, winnerImageUrl, onClose }: ShareResultDialogProps) {
  const { notify } = useToast()
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  // La promesa se guarda tal cual: Safari exige pasarla al ClipboardItem dentro del clic.
  const blobRef = useRef<Promise<Blob> | null>(null)
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null)
  const [failed, setFailed] = useState(false)
  const copyable = canCopyImages()

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    const promise = renderResultImage({ roundName, finalizedAt, podium, winnerImageUrl })
    blobRef.current = promise
    promise
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview({ url, blob })
      })
      .catch(() => !cancelled && setFailed(true))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [roundName, finalizedAt, podium, winnerImageUrl])

  // Foco inicial solo al abrir; Escape siempre usa el último onClose.
  useEffect(() => {
    closeRef.current?.focus()
  }, [])
  useEscapeKey(onClose)

  const copy = async () => {
    if (!blobRef.current) return
    try {
      await copyImage(blobRef.current)
      notify('Imagen copiada: pégala en Slack', 'success')
    } catch {
      notify('El navegador no dejó copiar la imagen. Descárgala y súbela a Slack.', 'error')
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 flex animate-fade-in items-center justify-center bg-night-900/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card flex max-h-full w-full max-w-3xl animate-bounce-in flex-col gap-4 overflow-y-auto p-6"
      >
        <h2 id={titleId} className="section-title">
          Compartir resultado
        </h2>
        <p className="text-body text-ink-muted">
          {copyable
            ? 'Copia la imagen y pégala en un canal de Slack.'
            : 'Descarga la imagen y súbela a un canal de Slack.'}
        </p>
        <div
          className="flex w-full items-center justify-center overflow-hidden rounded-img bg-surface-alt"
          style={{ aspectRatio: `${RESULT_WIDTH} / ${RESULT_HEIGHT}` }}
        >
          {preview ? (
            <img src={preview.url} alt={`Resultado de ${roundName}`} className="h-full w-full object-contain" />
          ) : failed ? (
            <p className="p-6 text-center text-body text-ink-muted">No se pudo generar la imagen. Intenta de nuevo.</p>
          ) : (
            <p className="flex items-center gap-3 text-body text-ink-muted" role="status">
              <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-hidden />
              Generando imagen…
            </p>
          )}
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={closeRef} type="button" className="btn btn-secondary w-full sm:w-auto" onClick={onClose}>
            Cerrar
          </button>
          <button
            type="button"
            className={`btn w-full sm:w-auto ${copyable ? 'btn-secondary' : 'btn-primary'}`}
            disabled={!preview}
            onClick={() => preview && downloadBlob(preview.blob, resultFilename(roundName))}
          >
            <Download className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            Descargar
          </button>
          {copyable && (
            <button type="button" className="btn btn-primary w-full sm:w-auto" disabled={!preview} onClick={() => void copy()}>
              <Copy className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              Copiar imagen
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
