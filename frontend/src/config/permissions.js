// Centralized role-based access config.
// Admin always has full access — never needs to be listed here.
// To grant a role write access: add its name to the array.
// To restrict: remove it. Quotations are defined but nav is hidden via NAV_ROLES.

export const WRITE_ROLES = {
  projects:     ['Engineer', 'Liaison'],
  employees:    ['HR'],
  materials:    ['Engineer'],
  inventory:    [],           // Admin only
  attendance:   ['HR'],
  transactions: ['Accounting'],
  suppliers:    ['Accounting'],
  settings:     [],           // Admin only
  archive:      [],           // Admin only (restore + permanent delete)
  quotations:   ['Engineer'], // defined for future use
}

// Nav paths visible only to the listed roles (plus Admin).
// Paths not listed here are visible to all authenticated users.
export const NAV_ROLES = {
  '/settings':   [],                          // Admin only
  '/quotations': ['Engineer'],                 // visible to Admin + Engineer
  '/archive':    [],                          // Admin only
  '/materials':  ['Engineer', 'Accounting', 'Liaison'],
  '/inventory':  ['Engineer', 'Accounting', 'Liaison'],
}
