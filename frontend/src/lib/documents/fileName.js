import { format } from 'date-fns'

// Shared naming convention for generated documents across the app.
export function buildDocFileName(prefix, clientName) {
  const safeClient = (clientName || 'Client').replace(/\s+/g, '')
  let dateStr = 'Today'
  try { dateStr = format(new Date(), 'MMMdd_yyyy') } catch { /* keep fallback */ }
  return `${prefix}_${safeClient}_${dateStr}`
}
