import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  pending?: boolean
  /** Deshabilita el botón de confirmar (por ejemplo, hasta escribir BORRAR). */
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancelar',
  danger = false,
  pending = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // El foco inicial va a "Cancelar" solo al abrir. Si dependiera de onCancel (una función nueva en
  // cada render del padre), cada tecla en un campo del diálogo le robaría el foco.
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEscapeKey(() => {
    if (!pending) onCancel()
  }, open)

  if (!open) return null

  // Portal a <body>: dentro de un ancestro con transform (el cajón) un position: fixed queda atrapado.
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex animate-fade-in items-center justify-center bg-night-900/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card flex w-full max-w-modal animate-bounce-in flex-col gap-4 p-6"
      >
        <h2 id={titleId} className="section-title">
          {title}
        </h2>
        <div className="text-body text-ink-muted">{children}</div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} type="button" className="btn btn-secondary w-full sm:w-auto" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn w-full sm:w-auto ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
