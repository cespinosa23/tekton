import { effectiveSupplyCost } from '../components/quotation/CostTypeEditor'
import { calcBomTotal } from '../components/quotation/BOMEditor'

// Cost categories that are always a plain manual number on a scope-of-work
// item's costing. 'supply' is handled separately since it's often BOM-derived
// rather than typed in directly (see effectiveSupplyCost). 'encumbrance' and
// 'others' are also handled separately — differently-named cost field, and
// carrying free text respectively.
const SIMPLE_COST_KEYS = ['wiring_permit', 'electrical_plan', 'installation', 'meralco']

// A Quotation can have several scope-of-work-items, each with its own full
// costing breakdown — but a Project has only one flat set of scope_* fields.
// Merge by summing each cost category across every scope-of-work-item; the
// result reconciles exactly with the quotation's own total_contract_cost,
// since that total is computed the same way (sum of every category, summed
// again across items — just addition regrouped).
export function buildProjectPrefillFromQuotation(quote) {
  const scopeItems = quote.scope_of_work_items || []

  const merged = {
    scope_wiring_permit: false, scope_wiring_permit_cost: 0,
    scope_electrical_plan: false, scope_electrical_plan_cost: 0,
    scope_supply: false, scope_supply_cost: 0,
    scope_installation: false, scope_installation_cost: 0,
    scope_meralco: false, scope_meralco_cost: 0,
    scope_encumbrance: false, encumbrance: 0,
    scope_others: false, scope_others_cost: 0, scope_others_text: '',
  }

  scopeItems.forEach(item => {
    const costing = item.costing || {}
    const bomTotal = calcBomTotal(item.bom_items || [])

    SIMPLE_COST_KEYS.forEach(key => {
      const flagField = `scope_${key}`
      const costField = `scope_${key}_cost`
      if (costing[flagField]) {
        merged[flagField] = true
        merged[costField] += parseFloat(costing[costField]) || 0
      }
    })

    // Supply is priced from the BOM (or a manual override) regardless of the
    // scope_supply flag itself — same "checked" logic CostTypeEditor uses to
    // decide whether to display/count it (effectiveSupplyCost > 0), not the
    // stored flag, which the quotation builder doesn't reliably keep in sync.
    const supplyAmt = effectiveSupplyCost(costing, bomTotal)
    if (supplyAmt > 0) {
      merged.scope_supply = true
      merged.scope_supply_cost += supplyAmt
    }

    if (costing.scope_encumbrance) {
      merged.scope_encumbrance = true
      merged.encumbrance += parseFloat(costing.encumbrance) || 0
    }

    if (costing.scope_others) {
      merged.scope_others = true
      merged.scope_others_cost += parseFloat(costing.scope_others_cost) || 0
    }
    if (costing.scope_others_text?.trim()) {
      merged.scope_others_text = merged.scope_others_text
        ? `${merged.scope_others_text}; ${costing.scope_others_text.trim()}`
        : costing.scope_others_text.trim()
    }
  })

  return {
    owner_company_name: quote.addressee_name || '',
    address: quote.addressee_address || '',
    project_name: quote.subject || '',
    quotation_date: quote.quotation_date || '',
    status: 'Active',
    // project_manager is resolved separately by the Projects page, which has
    // the Employee records (with middle names) needed to match its own
    // Project Manager dropdown options exactly.
    project_manager: '',
    referred_by: '',
    lgu: '',
    meralco_branch: '',
    // contract_cost is intentionally omitted — Projects.jsx recomputes it
    // from the scope_*_cost fields on save regardless, so passing a stale
    // number here would just be overwritten.
    other_notes: (quote.other_items || []).map(i => i.text).join('\n'),
    ...merged,
  }
}
