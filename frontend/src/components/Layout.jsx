import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import {
  LayoutDashboard, FolderKanban, ArrowLeftRight, Users,
  Package, Archive, ClipboardList, BookOpen, FolderArchive, Settings, LogOut
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/employees', icon: Users, label: 'Employees' },
  { to: '/materials', icon: Package, label: 'Materials' },
  { to: '/inventory', icon: Archive, label: 'Inventory' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { to: '/quotations', icon: BookOpen, label: 'Quotations' },
  { to: '/archive', icon: FolderArchive, label: 'Archive' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const { canSeeNav } = usePermissions()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gray-900 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">T</span>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-none">Tekton</p>
              <p className="text-xs text-gray-400 mt-0.5">Electrical Services</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.filter(({ to }) => canSeeNav(to)).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-900 truncate">{user?.email}</p>
            <p className="text-xs text-gray-400">
              {user?.roles?.[0]?.role?.name ?? 'User'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}