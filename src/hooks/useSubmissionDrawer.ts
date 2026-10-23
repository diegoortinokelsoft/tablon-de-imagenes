import { createContext, useContext } from 'react'

export interface SubmissionDrawerState {
  /** El cajón existe solo en el tablón con la competencia abierta. */
  available: boolean
  open: boolean
  setAvailable: (available: boolean) => void
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const SubmissionDrawerContext = createContext<SubmissionDrawerState>({
  available: false,
  open: false,
  setAvailable: () => {},
  setOpen: () => {},
  toggle: () => {},
})

export function useSubmissionDrawer() {
  return useContext(SubmissionDrawerContext)
}
