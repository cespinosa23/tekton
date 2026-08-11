import { formatNumberDisplay, normalizeNumberInput, sanitizeNumberInput } from '../../utils/numberInput'

export const FORM_SCOPES = [
  { key: 'wiring_permit', label: 'Wiring Permit / CFEI Processing', costField: 'scope_wiring_permit_cost', mirror: 'cfei' },
  { key: 'electrical_plan', label: 'Electrical Plan Drafting', costField: 'scope_electrical_plan_cost' },
  { key: 'supply', label: 'Supply of Materials', costField: 'scope_supply_cost', skipCost: true },
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

// Per scope type — costing is not shared across the whole quotation.
export function calcScopeCostTotal(data) {
  return FORM_SCOPES.reduce((sum, s) => {
    if (!data[`scope_${s.key}`] || s.skipCost) return sum
    return sum + (parseFloat(data[s.costField]) || 0)
  }, 0)
}

// Sum of every selected scope type's own costing.
export function calcAllScopeCostsTotal(scopeOfWorkItems = []) {
  return scopeOfWorkItems.reduce((sum, t) => sum + calcScopeCostTotal(t.costing || {}), 0)
}

export default function CostTypeEditor({ label, data, onChange, disabled = false }) {
  const toggleScope = (key, checked, mirror) => {
    onChange(`scope_${key}`, checked)
    if (mirror) onChange(`scope_${mirror}`, checked)
  }

  const handleSelectAll = (checked) => {
    FORM_SCOPES.filter(s => !s.hasRemarks).forEach(s => {
      onChange(`scope_${s.key}`, checked)
      if (s.mirror) onChange(`scope_${s.mirror}`, checked)
    })
  }

  const allSelected = FORM_SCOPES.filter(s => !s.hasRemarks).every(s => data[`scope_${s.key}`])
  const scopeTotal = calcScopeCostTotal(data)

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
          const checked = !!data[`scope_${scope.key}`]
          const costError = checked && !scope.skipCost && (data[scope.costField] === '' || data[scope.costField] == null)
          return (
            <div key={scope.key} className={`px-4 py-2.5 transition-colors ${checked ? 'bg-white' : 'bg-gray-50/50'}`}>
              <div className="flex items-center justify-between gap-4">
                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                  <input type="checkbox" checked={checked} disabled={disabled}
                    onChange={e => toggleScope(scope.key, e.target.checked, scope.mirror)}
                    className="w-4 h-4 rounded accent-gray-800 flex-shrink-0" />
                  <span className={`text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                    {scope.label}
                  </span>
                  {costError && <span className="text-xs text-red-500 ml-1">required</span>}
                </label>
                {scope.skipCost ? (
                  checked && <span className="text-xs text-gray-400 italic w-36 text-right">From Bill of Materials</span>
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
