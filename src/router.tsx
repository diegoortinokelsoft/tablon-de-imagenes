import { createBrowserRouter, Navigate } from 'react-router-dom'
import App from './App'
import LoginPage from './pages/LoginPage'
import BoardPage from './pages/BoardPage'
import HistoryPage from './pages/HistoryPage'
import HistoryDetailPage from './pages/HistoryDetailPage'
import AdminPage from './pages/AdminPage'
import StylesPage from './pages/StylesPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <App />,
    children: [
      { path: '/', element: <BoardPage /> },
      { path: '/historial', element: <HistoryPage /> },
      { path: '/historial/:roundId', element: <HistoryDetailPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/estilos', element: <StylesPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
