// Turns an API error into text that is always safe to show in a toast or an
// error line. FastAPI sends `detail` as a string for errors the app raises
// itself, but as a list of objects for request validation errors (422) —
// rendering that list directly crashes the page, so never show
// `err.response.data.detail` raw; use this instead.
const fieldLabel = (loc) => {
  const field = Array.isArray(loc) ? loc[loc.length - 1] : null
  return typeof field === 'string' ? field.replace(/_/g, ' ') : null
}

export function apiErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length) {
    const lines = detail.map(d => {
      if (typeof d === 'string') return d
      const label = fieldLabel(d?.loc)
      const msg = typeof d?.msg === 'string' ? d.msg : ''
      return label && msg ? `${label}: ${msg}` : msg
    }).filter(Boolean)
    if (lines.length) return lines.join('; ')
  }
  return fallback
}
