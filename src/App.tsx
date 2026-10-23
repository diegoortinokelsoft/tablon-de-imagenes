import { Outlet } from 'react-router-dom'
import Header from './components/Header'
import { RequireAuth } from './components/RouteGuards'

export default function App() {
  return (
    <RequireAuth>
      <Header />
      <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </RequireAuth>
  )
}
