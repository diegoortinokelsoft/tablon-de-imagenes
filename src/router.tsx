import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import { RequireAdmin } from './components/RouteGuards'
import LoginPage from './pages/LoginPage'
import BoardPage from './pages/BoardPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import AdminPage from './pages/AdminPage'
import StylesPage from './pages/StylesPage'
import ErrorPage from './pages/ErrorPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
  {
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      { path: '/', element: <BoardPage /> },
      { path: '/historial', element: <HistoryPage /> },
      { path: '/historial/:roundId', element: <HistoryDetailPage /> },
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
