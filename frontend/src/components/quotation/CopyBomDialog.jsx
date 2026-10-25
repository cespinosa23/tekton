import { useState } from 'react'
import { Copy, X } from 'lucide-react'
import { calcRow } from '../../lib/bomRow'
import { calcBomTotal } from './BOMEditor'

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Copies another scope type's BOM rows into this one, within the same
// quotation. Rows are copied exactly — catalog link, unit price, adjustment %,
// source, custom items and their review/zero-price flags — so nothing needs
// re-pricing (unlike an Excel round trip, which re-prices from inventory).
export default function CopyBomDialog({ targetName, targetItems = [], sources = [], onCopy, onClose }) {
  const [sourceId, setSourceId] = useState(sources[0]?.sow_type_id ?? null)
  const [mode, setMode] = useState('add') // 'add' | 'replace'
  const source = sources.find(s => s.sow_type_id === sourceId)
  const sourceItems = source?.bom_items || []
  const hasExisting = targetItems.length > 0

  const handleCopy = () => {
    // Independent copies (a later edit on one tab must never change the other).
    const copied = sourceItems.map(r => calcRow(JSON.parse(JSON.stringify(r))))
    onCopy(mode === 'replace' ? copied : [...targetItems, ...copied])
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Copy size={16} className="text-gray-700" />
            <h3 className="text-sm font-semibold text-gray-900">Copy BOM into {targetName}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-700 mb-2">Copy from</p>
            <div className="space-y-1.5">
              {sources.map(s => {
                const items = s.bom_items || []
                return (
                  <label key={s.sow_type_id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-md border cursor-pointer text-sm ${
                      sourceId === s.sow_type_id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}>
                    <span className="flex items-center gap-2">
                      <input type="radio" name="copy-source" checked={sourceId === s.sow_type_id}
                        onChange={() => setSourceId(s.sow_type_id)} className="accent-gray-800" />
                      {s.sow_type_name}
                    </span>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {items.length} item{items.length === 1 ? '' : 's'} · {fmt(calcBomTotal(items))}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          {hasExisting && (
            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                {targetName} already has {targetItems.length} item{targetItems.length === 1 ? '' : 's'}
              </p>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="copy-mode" checked={mode === 'add'} onChange={() => setMode('add')} className="mt-0.5 accent-gray-800" />
                  <span><strong>Add</strong> the copied items after the existing ones</span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="copy-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} className="mt-0.5 accent-gray-800" />
                  <span><strong>Replace</strong> the existing items <span className="text-red-600">(they will be removed)</span></span>
                </label>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Items are copied exactly as they are: prices, adjustment %, sources and custom items. You can still edit them here afterwards; the original tab isn&apos;t affected.
          </p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={handleCopy} disabled={!source || sourceItems.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
            <Copy size={14} /> {mode === 'replace' && hasExisting ? 'Replace with' : 'Copy'} {sourceItems.length} item{sourceItems.length === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  )
}
