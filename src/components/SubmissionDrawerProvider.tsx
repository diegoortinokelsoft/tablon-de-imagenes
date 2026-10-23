import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { SubmissionDrawerContext } from '../hooks/useSubmissionDrawer'

/** Estado del cajón "Mi publicación", compartido entre el encabezado y el tablón. Arranca siempre oculto. */
export default function SubmissionDrawerProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false)
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen((value) => !value), [])
  const value = useMemo(() => ({ available, open, setAvailable, setOpen, toggle }), [available, open, toggle])
  return <SubmissionDrawerContext.Provider value={value}>{children}</SubmissionDrawerContext.Provider>
}
