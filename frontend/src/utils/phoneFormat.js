// Company phone fields store one number per line — this groups them 2-per-line
// for compact letterhead display (used by BillingPrint and QuotePreview).
export function formatPhoneLines(text) {
  if (!text) return []
  const numbers = text.split('\n').map(s => s.trim()).filter(Boolean)
  const lines = []
  for (let i = 0; i < numbers.length; i += 2) {
    lines.push(numbers.slice(i, i + 2).join(' / '))
  }
  return lines
}
