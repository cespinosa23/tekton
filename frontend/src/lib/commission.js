// Shared by the Commissions page and Settings → Commission Defaults.
//
// Project Management commission, two methods (chosen per record):
//   assumed_margin: Project Cost × margin % × rate
//   actual:         (Project Cost − actual expenses) × rate
// Electrical Plan: Electrical Plan cost × rate.

export const METHOD_LABELS = {
  assumed_margin: 'Assumed margin',
  actual: 'Actual expenses',
}

export const METHOD_FORMULAS = {
  assumed_margin: 'Project cost × margin % × rate',
  actual: '(Project cost − actual expenses) × rate',
}

// A percentage as typed: 0–100, at most 2 decimals.
export const isValidPercent = (v) => /^\d{1,3}(\.\d{1,2})?$/.test(String(v ?? '').trim()) && Number(v) <= 100
// While typing, block anything that can't become a valid percentage.
export const isTypablePercent = (v) => /^\d{0,3}(\.\d{0,2})?$/.test(v)

// API rows carry fractions (0.07); defaults come as percent strings ("7.00").
export const fractionToPct = (fraction) => Number((Number(fraction) * 100).toFixed(2))
export const pctLabel = (pct) => (pct == null ? '…' : `${Number(pct)}%`)
