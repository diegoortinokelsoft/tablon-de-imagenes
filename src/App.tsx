import { Outlet } from 'react-router-dom'
import Header from './components/Header'
import { RequireAuth } from './components/RouteGuards'
import SubmissionDrawerProvider from './components/SubmissionDrawerProvider'
import { useHubRealtime } from './hooks/useRealtime'

function AuthenticatedLayout() {
  // El canal de cada competencia lo abre su página; el del hub queda siempre abierto (es liviano).
  useHubRealtime()
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </>
  )
}

export default function App() {
  return (
    <RequireAuth>
      <SubmissionDrawerProvider>
        <AuthenticatedLayout />
      </SubmissionDrawerProvider>
    </RequireAuth>
  )
}
