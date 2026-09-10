// A material's BOM/report price doesn't ask the user to pick a Brand — across
// all Inventory buckets for that material (one per brand), use whichever has
// the highest tracked cost, the same "top entry" price Outgoing/Incoming
// Materials transactions use.
export function bestInventoryFor(materialId, inventoryRecords) {
  const matches = inventoryRecords.filter(r => r.material_id === materialId && !r.archived)
  if (matches.length === 0) return null
  return matches.reduce((best, r) =>
    (Number(r.latest_unit_cost) || 0) > (Number(best.latest_unit_cost) || 0) ? r : best
  )
}
