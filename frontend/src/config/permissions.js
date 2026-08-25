// Centralized role-based access config.
// Admin always has full access — never needs to be listed here.
// To grant a role write access: add its name to the array.
// To restrict: remove it. Quotations are defined but nav is hidden via NAV_ROLES.

export const WRITE_ROLES = {
  projects:     ['Project Coordinator', 'Project Manager'],
  employees:    ['Project Coordinator'],
  materials:    [],                         // Admin only
  inventory:    ['Project Coordinator', 'Project Manager'],
  attendance:   ['Project Coordinator', 'Project Manager'],
  transactions: ['Project Coordinator'],
  suppliers:    [],                         // Admin only
  settings:     [],                         // Admin only
  archive:      [],                         // Admin only (restore + permanent delete)
  quotations:   ['Project Coordinator', 'Project Manager', 'Engineer'],
  billing:      [],                         // Admin only
}

// Nav paths visible only to the listed roles (plus Admin).
// Paths not listed here are visible to all authenticated users.
export const NAV_ROLES = {
  '/settings':      [],                     // Admin only
  '/quotations':    ['Project Coordinator', 'Project Manager', 'Engineer'],
  '/archive':       [],                     // Admin only
  '/materials':     [],                     // Admin only
  '/inventory':     ['Project Coordinator', 'Project Manager'],
  '/transactions':  ['Project Coordinator'],
  '/employees':     ['Project Coordinator'],
  '/projects':      ['Project Coordinator', 'Project Manager'],
  '/attendance':    ['Project Coordinator', 'Project Manager'],
  '/reports':       [],                     // Admin only
  '/billings':      [],                     // Admin only
}
