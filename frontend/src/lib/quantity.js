// Quantities (BOM rows, materials transactions) allow up to 2 decimal places —
// matching how stock levels are stored — and can be typed as fractions:
// "1/4" -> 0.25, "3/4" -> 0.75, "1 1/2" -> 1.5.

export const QTY_DECIMALS = 2

export const roundQty = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// While typing: digits, one decimal point with up to 2 decimals, or a
// (mixed) fraction still being typed. Anything else is rejected.
export function isTypableQuantity(text) {
  return /^\d*\.?\d{0,2}$/.test(text) || /^\d+(\s+\d*)?(\/\d*)?$/.test(text) || /^\d+\s+\d+\/\d*$/.test(text)
}

// ── Quotation documents: KG quantities are printed as fractions ──────────
// (client request, Oct 2026). 0.25 kg -> "1/4", 1.5 kg -> "1 1/2". Stored
// quantities have 2 decimals, so a typed 1/3 is 0.33 and 1/8 is 0.13; the
// fraction chosen is the first one, in this order of how common it is, that
// rounds back to the stored value — so those come back as 1/3 and 1/8.
const KG_UNITS = new Set(['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms'])
const FRACTION_DENOMINATORS = [2, 4, 3, 8, 5, 10, 16, 20, 25, 50, 100]

export const isKgUnit = (unit) => KG_UNITS.has(String(unit || '').trim().toLowerCase().replace(/\.$/, ''))

export function toFractionText(quantity) {
  const q = roundQty(Number(quantity) || 0)
  const whole = Math.floor(q)
  const part = roundQty(q - whole)
  if (part === 0) return String(whole)
  for (const d of FRACTION_DENOMINATORS) {
    const n = Math.round(part * d)
    if (n > 0 && n < d && roundQty(n / d) === part) {
      return whole > 0 ? `${whole} ${n}/${d}` : `${n}/${d}`
    }
  }
  return String(q)
}

// How a BOM quantity is printed on the quotation (preview, PDF, Word):
// fractions for KG, the number as-is for every other unit.
export function formatBomQuantity(quantity, unit) {
  if (quantity === null || quantity === undefined || quantity === '') return ''
  return isKgUnit(unit) ? toFractionText(quantity) : String(quantity)
}

// Full value -> number (rounded to 2 decimals), or null if it isn't a valid
// quantity yet. Empty counts as 0.
export function parseQuantity(text) {
  const t = String(text ?? '').trim().replace(/\s+/g, ' ')
  if (t === '') return 0
  let m = t.match(/^(\d+) (\d+)\/(\d+)$/)
  if (m) return Number(m[3]) > 0 ? roundQty(Number(m[1]) + Number(m[2]) / Number(m[3])) : null
  m = t.match(/^(\d+)\/(\d+)$/)
  if (m) return Number(m[2]) > 0 ? roundQty(Number(m[1]) / Number(m[2])) : null
  if (/^\d*\.?\d+$/.test(t) || /^\d+\.$/.test(t)) return roundQty(parseFloat(t))
  return null
}
