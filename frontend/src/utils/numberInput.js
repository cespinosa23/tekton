// Shared formatting/sanitizing for controlled numeric text inputs (money, percentages).
// Using type="text" instead of type="number" lets us block leading zeros ("0" + digit)
// and apply thousands-separator formatting, which native number inputs can't do.

export const formatNumberDisplay = (raw) => {
  if (raw === '' || raw === undefined || raw === null) return ''
  const str = String(raw)
  // Keep a leading minus (only ever produced by fields that opt in to negatives).
  if (str.startsWith('-')) return '-' + formatNumberDisplay(str.slice(1))
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
// Negatives are off by default; a field that legitimately holds a deduction (e.g. a
// project's "Others" cost carrying a quotation discount) opts in with allowNegative.
export const sanitizeNumberInput = (value, { allowNegative = false } = {}) => {
  let raw = value.replace(/,/g, '')
  let sign = ''
  if (allowNegative && raw.startsWith('-')) {
    sign = '-'
    raw = raw.slice(1)
  }
  if (!/^\d*\.?\d*$/.test(raw)) return null
  if (/^0\d/.test(raw)) return null // block leading zeros like "01..."
  return sign + raw
}
