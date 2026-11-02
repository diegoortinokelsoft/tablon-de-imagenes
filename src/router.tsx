import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import { LegacyHistoryRedirect, RequireAdmin } from './components/RouteGuards'
import LoginPage from './pages/LoginPage'
import HubPage from './pages/HubPage'
import RoundPage from './pages/RoundPage'
import ManagePage from './pages/ManagePage'
import JoinPage from './pages/JoinPage'
import AdminPage from './pages/AdminPage'
import StylesPage from './pages/StylesPage'
import ErrorPage from './pages/ErrorPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  {
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <HubPage /> },
      { path: '/c/:roundId', element: <RoundPage /> },
      { path: '/c/:roundId/gestion', element: <ManagePage /> },
      { path: '/invitacion/:token', element: <JoinPage /> },
      { path: '/historial', element: <Navigate to="/" replace /> },
      { path: '/historial/:roundId', element: <LegacyHistoryRedirect /> },
      {
        path: '/admin',
        element: (
          <RequireAdmin>
            <AdminPage />
          </RequireAdmin>
        ),
      },
      {
        path: '/estilos',
        element: (
          <RequireAdmin>
            <StylesPage />
          </RequireAdmin>
        ),
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
