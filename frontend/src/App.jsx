import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LanguageProvider } from './context/LanguageContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import FilesPage from './pages/FilesPage'
import AuditPage from './pages/AuditPage'
import ThreatsPage from './pages/ThreatsPage'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'

// Захищений маршрут
function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"
             style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Публічний маршрут (редірект якщо вже авторизований)
function PublicRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"
             style={{ borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }}></div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* Публічні маршрути */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />

      {/* Захищені маршрути */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="files" element={<FilesPage />} />
        <Route
          path="audit"
          element={
            <ProtectedRoute roles={['admin']}>
              <AuditPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="threats"
          element={
            <ProtectedRoute roles={['admin']}>
              <ThreatsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
