import { useState } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import { formatNumberDisplay, normalizeNumberInput, sanitizeNumberInput } from '../../utils/numberInput'
import { calcBomTotal } from './BOMEditor'

export const FORM_SCOPES = [
  { key: 'wiring_permit', label: 'Wiring Permit / CFEI Processing', costField: 'scope_wiring_permit_cost', mirror: 'cfei' },
  { key: 'electrical_plan', label: 'Electrical Plan Drafting', costField: 'scope_electrical_plan_cost' },
  { key: 'supply', label: 'Supply of Materials', costField: 'scope_supply_cost', skipCost: true, auto: true },
  { key: 'installation', label: 'Installation Works', costField: 'scope_installation_cost' },
  { key: 'meralco', label: 'Meralco Application', costField: 'scope_meralco_cost' },
  { key: 'encumbrance', label: 'Encumbrance', costField: 'encumbrance' },
  { key: 'others', label: 'Others', costField: 'scope_others_cost', hasRemarks: true },
]

export const emptyCosting = () => ({
  scope_wiring_permit: false, scope_cfei: false, scope_wiring_permit_cost: '',
  scope_electrical_plan: false, scope_electrical_plan_cost: '',
  scope_supply: false, scope_supply_cost: '',
  scope_installation: false, scope_installation_cost: '',
  scope_meralco: false, scope_meralco_cost: '',
  scope_encumbrance: false, encumbrance: '',
  scope_others: false, scope_others_cost: '', scope_others_text: '',
})

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Supply of Materials is normally auto-priced from the scope type's own Bill
// of Materials tab, but real-world pricing sometimes differs from a strict
// qty×price BOM total (negotiated discounts, etc.) — scope_supply_cost holds
// an optional manual override for THIS quotation only; it never touches BOM.
export const supplyOverridden = (data) => data.scope_supply_cost !== '' && data.scope_supply_cost != null
export const effectiveSupplyCost = (data, bomTotal) =>
  supplyOverridden(data) ? (parseFloat(data.scope_supply_cost) || 0) : bomTotal

// Per scope type — costing is not shared across the whole quotation.
export function calcScopeCostTotal(data, bomTotal = 0) {
  const manual = FORM_SCOPES.reduce((sum, s) => {
    if (s.auto || !data[`scope_${s.key}`] || s.skipCost) return sum
    return sum + (parseFloat(data[s.costField]) || 0)
  }, 0)
  return manual + effectiveSupplyCost(data, bomTotal)
}

// Sum of every selected scope type's own costing (including its BOM-derived Supply cost).
export function calcAllScopeCostsTotal(scopeOfWorkItems = []) {
  return scopeOfWorkItems.reduce((sum, t) => sum + calcScopeCostTotal(t.costing || {}, calcBomTotal(t.bom_items || [])), 0)
}

// Shows the auto BOM-derived Supply amount, with a pencil icon that lets the
// user override it for this quotation only — never writes back to the BOM.
function SupplyAmountCell({ data, bomTotal, disabled, onChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const overridden = supplyOverridden(data)
  const effective = effectiveSupplyCost(data, bomTotal)

  const startEditing = () => {
    setDraft(String(overridden ? data.scope_supply_cost : bomTotal))
    setEditing(true)
  }

  const commit = () => {
    onChange('scope_supply_cost', normalizeNumberInput(draft))
    setEditing(false)
  }

  if (editing) {
    return (
      <input type="text" autoFocus
        value={formatNumberDisplay(draft)}
        onChange={e => {
          const sanitized = sanitizeNumberInput(e.target.value)
          if (sanitized === null) return
          setDraft(sanitized)
        }}
        onBlur={commit}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        className="w-28 px-2 py-1.5 text-right border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
    )
  }

  return (
    <div className="flex items-center justify-end gap-1.5 w-36">
      {overridden && !disabled && (
        <button type="button" onClick={() => onChange('scope_supply_cost', '')} title="Reset to BOM total"
          className="text-gray-300 hover:text-red-500"><RotateCcw size={12} /></button>
      )}
      <span className={`text-sm text-right ${effective > 0 ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>{fmt(effective)}</span>
      {overridden && <span className="text-[10px] text-amber-600 font-medium">edited</span>}
      {!disabled && (
        <button type="button" onClick={startEditing} title="Override this quotation's Supply cost (won't change the BOM)"
          className="text-gray-300 hover:text-gray-600"><Pencil size={12} /></button>
      )}
    </div>
  )
}

export default function CostTypeEditor({ label, data, onChange, bomTotal = 0, disabled = false }) {
  const toggleScope = (key, checked, mirror) => {
    onChange(`scope_${key}`, checked)
    if (mirror) onChange(`scope_${mirror}`, checked)
  }

  const handleSelectAll = (checked) => {
    FORM_SCOPES.filter(s => !s.hasRemarks && !s.auto).forEach(s => {
      onChange(`scope_${s.key}`, checked)
      if (s.mirror) onChange(`scope_${s.mirror}`, checked)
    })
  }

  const allSelected = FORM_SCOPES.filter(s => !s.hasRemarks && !s.auto).every(s => data[`scope_${s.key}`])
  const scopeTotal = calcScopeCostTotal(data, bomTotal)

  const costInput = (field, checked, hasError) => (
    <input type="text" disabled={!checked || disabled}
      value={checked ? formatNumberDisplay(data[field]) : ''}
      placeholder="Required"
      onChange={e => {
        const sanitized = sanitizeNumberInput(e.target.value)
        if (sanitized === null) return
        onChange(field, sanitized)
      }}
      onBlur={() => { if (checked && !disabled) onChange(field, normalizeNumberInput(data[field])) }}
      className={`w-36 px-3 py-1.5 text-right border rounded-md text-sm focus:outline-none focus:ring-2 ${
        !checked
          ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed focus:ring-gray-400'
          : hasError
          ? 'border-red-400 bg-red-50 text-gray-900 focus:ring-red-300'
          : 'border-gray-300 bg-white text-gray-900 focus:ring-gray-400'
      }`} />
  )

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{label}</p>
        {!disabled && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)}
              className="w-4 h-4 rounded accent-gray-800" />
            <span className="text-xs text-gray-500 font-medium">Select All</span>
          </label>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
        <span className="text-xs text-gray-400">Scope</span>
        <span className="text-xs text-gray-400 w-36 text-right">Contract Cost (₱)</span>
      </div>
      <div className="divide-y divide-gray-100">
        {FORM_SCOPES.map(scope => {
          const checked = scope.auto ? effectiveSupplyCost(data, bomTotal) > 0 : !!data[`scope_${scope.key}`]
          const costError = checked && !scope.skipCost && (data[scope.costField] === '' || data[scope.costField] == null)
          return (
            <div key={scope.key} className={`px-4 py-2.5 transition-colors ${checked ? 'bg-white' : 'bg-gray-50/50'}`}>
              <div className="flex items-center justify-between gap-4">
                <label className={`flex items-center gap-2.5 flex-1 ${scope.auto ? '' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={checked} disabled={disabled || scope.auto}
                    onChange={e => toggleScope(scope.key, e.target.checked, scope.mirror)}
                    className="w-4 h-4 rounded accent-gray-800 flex-shrink-0" />
                  <span className={`text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {scope.label}
                  </span>
                  {scope.auto && <span className="text-xs text-gray-400">(auto, from BOM)</span>}
                  {costError && <span className="text-xs text-red-500 ml-1">required</span>}
                </label>
                {scope.auto ? (
                  <SupplyAmountCell data={data} bomTotal={bomTotal} disabled={disabled} onChange={onChange} />
                ) : (
                  costInput(scope.costField, checked, costError)
                )}
              </div>
              {scope.hasRemarks && checked && (
                <div className="mt-2 ml-6">
                  <input placeholder="Specify scope / remarks..." disabled={disabled}
                    value={data.scope_others_text || ''}
                    onChange={e => onChange('scope_others_text', e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700" />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
        <span className="text-sm font-semibold">Scope Cost Subtotal</span>
        <span className="text-base font-bold">₱{scopeTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}</span>
      </div>
    </div>
  )
}
