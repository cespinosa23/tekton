import { useAuth } from '../context/AuthContext'
import { WRITE_ROLES, NAV_ROLES } from '../config/permissions'

export function usePermissions() {
  const { isAdmin, hasRole } = useAuth()

  // Returns true if the current user can perform write operations on the given page.
  const canWrite = (page) => {
    if (isAdmin()) return true
    return (WRITE_ROLES[page] ?? []).some(role => hasRole(role))
  }

  // Returns true if the nav item at `path` should be visible to the current user.
  const canSeeNav = (path) => {
    if (!(path in NAV_ROLES)) return true
    if (isAdmin()) return true
    return (NAV_ROLES[path] ?? []).some(role => hasRole(role))
  }

  return { canWrite, canSeeNav }
}
