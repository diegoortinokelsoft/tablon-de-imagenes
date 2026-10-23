import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastApi {
  notify: (message: string, type?: ToastType) => void
}

export const ToastContext = createContext<ToastApi>({ notify: () => {} })

export function useToast() {
  return useContext(ToastContext)
}
