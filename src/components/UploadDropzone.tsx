import { useEffect, useRef, useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { ACCEPT_ATTRIBUTE, firstImageFile } from '../lib/image'

interface UploadDropzoneProps {
  onFile: (file: File) => void
  disabled?: boolean
  /** Escucha Ctrl+V en toda la página mientras está montada. */
  listenPaste?: boolean
}

export default function UploadDropzone({ onFile, disabled = false, listenPaste = true }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!listenPaste || disabled) return
    const onPaste = (event: ClipboardEvent) => {
      const file = firstImageFile(event.clipboardData?.files)
      if (!file) return // pegar texto en el título no se intercepta
      event.preventDefault()
      onFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [listenPaste, disabled, onFile])

  const open = () => {
    if (!disabled) inputRef.current?.click()
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label="Subir imagen: arrastra, elige o pega (Ctrl+V) tu captura"
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          open()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        const file = firstImageFile(event.dataTransfer.files)
        if (file && !disabled) onFile(file)
      }}
      className={`flex cursor-pointer flex-col items-center gap-3 rounded-card border-3 border-dashed bg-surface-alt p-8 text-center transition duration-150 ${
        dragging ? 'border-sun' : 'border-brand-400'
      } ${disabled ? 'pointer-events-none opacity-45' : ''}`}
    >
      <ImagePlus className="h-12 w-12 text-brand-600" strokeWidth={2.5} aria-hidden />
      <p className="text-secondary text-ink-muted">Arrastra, elige o pega (Ctrl+V) tu captura</p>
      <p className="text-label uppercase text-ink-muted">JPG, PNG o WEBP · hasta 5 MB</p>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={(event) => {
          const file = firstImageFile(event.target.files)
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </div>
  )
}
