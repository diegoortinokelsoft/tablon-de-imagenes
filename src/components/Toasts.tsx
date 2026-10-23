import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastType } from '../hooks/useToast'

interface Toast {
  id: number
  message: string
  type: ToastType
}

const BORDER: Record<ToastType, string> = {
  success: 'border-success',
  error: 'border-danger',
  info: 'border-sky',
}

const DURATION_MS = 4000

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(0)

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, message, type }])
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), DURATION_MS)
  }, [])

  const api = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
        aria-live="polite"
        role="status"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`animate-bounce-in rounded-full border-3 bg-night-800 px-6 py-3 text-center text-secondary text-on-night shadow-card ${BORDER[toast.type]}`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
