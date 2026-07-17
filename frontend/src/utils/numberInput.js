// Shared formatting/sanitizing for controlled numeric text inputs (money, percentages).
// Using type="text" instead of type="number" lets us block leading zeros ("0" + digit)
// and apply thousands-separator formatting, which native number inputs can't do.

export const formatNumberDisplay = (raw) => {
  if (raw === '' || raw === undefined || raw === null) return ''
  const str = String(raw)
  const parts = str.split('.')
  const intFormatted = (parseInt(parts[0], 10) || 0).toLocaleString('en-US')
  if (parts.length === 1) return intFormatted
  return intFormatted + '.' + parts[1] // preserve decimal as-typed (trailing zeros allowed while typing)
}

export const normalizeNumberInput = (raw) => {
  if (raw === '' || raw === '.' || raw === undefined) return ''
  const num = parseFloat(raw)
  if (isNaN(num)) return ''
  return String(num) // parseFloat removes trailing zeros: "100.50" → "100.5"
}

// Returns the sanitized raw (comma-free) string, or null if the keystroke should be rejected.
export const sanitizeNumberInput = (value) => {
  const raw = value.replace(/,/g, '')
  if (!/^\d*\.?\d*$/.test(raw)) return null
  if (/^0\d/.test(raw)) return null // block leading zeros like "01..."
  return raw
}
