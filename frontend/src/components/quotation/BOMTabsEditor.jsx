import { useState } from 'react'
import { Copy } from 'lucide-react'
import BOMEditor, { bomValid, calcBomTotal } from './BOMEditor'
import CopyBomDialog from './CopyBomDialog'

// Every selected scope type gets a BOM tab — Costing (which comes after this
// step) reads whichever of these end up with materials in them, so BOM can't
// be gated on a Costing checkbox here without a chicken-and-egg problem.
export const calcAllBomTotal = (scopeOfWorkItems = []) =>
  scopeOfWorkItems.reduce((s, t) => s + calcBomTotal(t.bom_items || []), 0)

export const allBomValid = (scopeOfWorkItems = []) =>
  scopeOfWorkItems.every(t => bomValid(t.bom_items || []))

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function BOMTabsEditor({ scopeOfWorkItems = [], onChange, materials = [], materialTypes = [], inventoryRecords = [], suppliers = [], disabled = false }) {
  const bomTypes = scopeOfWorkItems
  const [activeTypeId, setActiveTypeId] = useState(bomTypes[0]?.sow_type_id ?? null)
  const [copyOpen, setCopyOpen] = useState(false)

  const activeType = bomTypes.find(t => t.sow_type_id === activeTypeId) || bomTypes[0]
  // Other scope types on this quotation that have something to copy.
  const copySources = bomTypes.filter(t => t.sow_type_id !== activeType?.sow_type_id && (t.bom_items || []).length > 0)

  if (bomTypes.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
        No Scope of Work types selected yet — go back to Scope of Works first.
      </div>
    )
  }

  const grandTotal = calcAllBomTotal(scopeOfWorkItems)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 rounded-lg text-white">
        <span className="text-sm font-semibold">BOM Grand Total (all scope types)</span>
        <span className="text-base font-bold">{fmt(grandTotal)}</span>
      </div>

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {bomTypes.map(t => {
          const isActive = (activeType?.sow_type_id) === t.sow_type_id
          const typeTotal = calcBomTotal(t.bom_items || [])
          const invalid = !bomValid(t.bom_items || [])
          return (
            <button key={t.sow_type_id} onClick={() => setActiveTypeId(t.sow_type_id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                isActive ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.sow_type_name}
              <span className={`text-xs ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>{fmt(typeTotal)}</span>
              {invalid && <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="Missing required Source on a custom or manually priced material, or a material with 0 price not yet confirmed" />}
            </button>
          )
        })}
      </div>

      {activeType && (
        <BOMEditor
          items={activeType.bom_items || []}
          onChange={items => onChange(activeType.sow_type_id, items)}
          materials={materials}
          materialTypes={materialTypes}
          inventoryRecords={inventoryRecords}
          suppliers={suppliers}
          disabled={disabled}
          scopeName={activeType.sow_type_name}
          extraActions={copySources.length > 0 && (
            <button onClick={() => setCopyOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 text-gray-600">
              <Copy size={14} /> Copy from another scope
            </button>
          )}
        />
      )}

      {copyOpen && activeType && !disabled && (
        <CopyBomDialog
          targetName={activeType.sow_type_name}
          targetItems={activeType.bom_items || []}
          sources={copySources}
          onCopy={items => { onChange(activeType.sow_type_id, items); setCopyOpen(false) }}
          onClose={() => setCopyOpen(false)}
        />
      )}
    </div>
  )
}
