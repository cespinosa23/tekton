// A single BOM row's shape and its derived-total math — split out of
// BOMEditor.jsx (which still re-exports both, so existing imports keep
// working) so lib/bomImport.js can depend on this instead of on the
// component file. Importing them from BOMEditor.jsx directly would create a
// cycle: BOMEditor.jsx -> BomImportModal.jsx -> bomImport.js -> BOMEditor.jsx.

export const emptyBomRow = () => ({
  is_custom: false,
  material_type: '',
  material_id: null,
  material_name: '',
  unit: '',
  quantity: 1,
  unit_price: 0,
  subtotal: 0,
  adjustment_pct: 20,
  adjusted_subtotal: 0,
  source: '',
  price_entry_date: null,
  is_canvass_price: false,
  zero_price_confirmed: false,
  // Set only by bulk import (see bomImport.js) on rows it couldn't match to
  // an existing catalog material — a distinct flag from zero_price_confirmed,
  // which means "confirmed genuinely free," so a reviewer can't clear this
  // one by accident while acknowledging that. Cleared by BOMEditor's `update`
  // once the row is actually resolved (real price entered, or zero
  // explicitly confirmed).
  needs_review: false,
})

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

export function calcRow(row) {
  const subtotal = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0)
  const adjPct = Number.isFinite(Number(row.adjustment_pct)) ? Number(row.adjustment_pct) : 20
  const adjustedSubtotal = subtotal * (1 + adjPct / 100)
  return { ...row, subtotal: round2(subtotal), adjusted_subtotal: round2(adjustedSubtotal) }
}
