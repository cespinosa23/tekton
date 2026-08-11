import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Layout from './components/Layout'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Materials from './pages/Materials'
import Settings from './pages/Settings'
import ResetPassword from './pages/ResetPassword'
import CompleteRegistration from './pages/CompleteRegistration'
import Inventory from './pages/Inventory'
import Projects from './pages/Projects'
import ProjectView from './pages/ProjectView'
import Transactions from './pages/transactions/index'
import Archive from './pages/Archive'
import Quotations from './pages/Quotations'
import Reports from './pages/Reports'
import BillingPrint from './pages/BillingPrint'
import Billings from './pages/Billings'
import { isProduction } from './utils/environment'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

// Quotations is still being rolled out — hidden on production for now, but
// stays fully available on staging/local so testing isn't blocked.
function HiddenOnProduction({ children }) {
  return isProduction() ? <Navigate to="/dashboard" replace /> : children
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/dashboard" replace /> : children
}

function Placeholder({ title }) {
  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">Coming soon</p>
      </div>
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><ProjectView /></ProtectedRoute>} />
      <Route path="/projects/:id/billing/:billingId/print" element={<ProtectedRoute><BillingPrint /></ProtectedRoute>} />
      <Route path="/billings" element={<ProtectedRoute><Billings /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><Employees /></ProtectedRoute>} />
      <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/attendance" element={<ProtectedRoute><Attendance /></ProtectedRoute>} />
      <Route path="/quotations" element={<ProtectedRoute><HiddenOnProduction><Quotations /></HiddenOnProduction></ProtectedRoute>} />
      <Route path="/archive" element={<ProtectedRoute><Archive /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/complete-registration" element={<CompleteRegistration />} />
      
    </Routes>
  )
}