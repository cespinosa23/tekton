import { useAuth } from '../context/AuthContext'
import { WRITE_ROLES, NAV_ROLES } from '../config/permissions'

export function usePermissions() {
  const { isAdmin, hasRole, user } = useAuth()

  const canWrite = (page) => {
    if (isAdmin()) return true
    return (WRITE_ROLES[page] ?? []).some(role => hasRole(role))
  }

  const canSeeNav = (path) => {
    // Users with no assigned roles can only see the Dashboard
    const hasNoRoles = !isAdmin() && !(user?.roles?.length > 0)
    if (hasNoRoles) return path === '/dashboard'

    if (!(path in NAV_ROLES)) return true
    if (isAdmin()) return true
    return (NAV_ROLES[path] ?? []).some(role => hasRole(role))
  }

  return { canWrite, canSeeNav }
}
