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
  billing:      ['Project Manager'],
}

// TEMPORARY (decided Oct 27, 2026; to be restricted again later): everyone
// with Quotations access (PC, PM, Engineer, Admin) can see and edit ANY
// quotation, not only their own. Approval is unchanged (Admin or the assigned
// PM approve/reject; Admin/PM finalize directly). Set to false — together
// with QUOTATIONS_OPEN_TO_ALL in backend/app/api/quotations.py — to bring
// back "own quotations only".
export const QUOTATIONS_OPEN_TO_ALL = true

// Nav paths visible only to the listed roles (plus Admin).
// Paths not listed here are visible to all authenticated users.
export const NAV_ROLES = {
  '/settings':      [],                     // Admin only
  '/quotations':    ['Project Coordinator', 'Project Manager', 'Engineer'],
  '/archive':       [],                     // Admin only
  '/materials':     ['Project Coordinator'], // View only — WRITE_ROLES.materials stays Admin-only
  '/inventory':     ['Project Coordinator', 'Project Manager'],
  '/transactions':  ['Project Coordinator'],
  '/employees':     ['Project Coordinator'],
  '/projects':      ['Project Coordinator', 'Project Manager'],
  '/attendance':    ['Project Coordinator', 'Project Manager'],
  '/reports':       [],                     // Admin only
  '/billings':      ['Project Manager'],
  '/commissions':   [],                     // Admin only
}
