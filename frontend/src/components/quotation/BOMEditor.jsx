import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import MaterialCombobox from '../MaterialCombobox'

export const emptyBomRow = () => ({
  is_custom: false,
  material_type: '',
  material_id: null,
  material_name: '',
  unit: '',
  quantity: 1,
  unit_price: 0,
  subtotal: 0,
  adjustment_pct: 100,
  adjusted_subtotal: 0,
  source: '',
  price_entry_date: null,
})

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

function calcRow(row) {
  const subtotal = (Number(row.quantity) || 0) * (Number(row.unit_price) || 0)
  const adjPct = Number.isFinite(Number(row.adjustment_pct)) ? Number(row.adjustment_pct) : 100
  const adjustedSubtotal = subtotal * (adjPct / 100)
  return { ...row, subtotal: round2(subtotal), adjusted_subtotal: round2(adjustedSubtotal) }
}

// BOM doesn't ask the user to pick a Brand — across all Inventory buckets for
// this material (one per brand), use whichever has the highest tracked cost,
// same "top entry" price Outgoing/Incoming Materials transactions use.
function bestInventoryFor(materialId, inventoryRecords) {
  const matches = inventoryRecords.filter(r => r.material_id === materialId && !r.archived)
  if (matches.length === 0) return null
  return matches.reduce((best, r) =>
    (Number(r.latest_unit_cost) || 0) > (Number(best.latest_unit_cost) || 0) ? r : best
  )
}

// A custom row needs a Source typed in manually (no DB material to derive it from).
export const bomValid = (items = []) => items.every(row => !row.is_custom || row.source?.trim())

export const calcBomTotal = (items = []) => items.reduce((s, r) => s + (r.adjusted_subtotal || 0), 0)

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const inp = 'px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 w-full'
const roInp = 'px-2 py-1.5 border border-gray-200 bg-gray-50 rounded text-sm text-gray-500 w-full'

export default function BOMEditor({ items = [], onChange, materials = [], materialTypes = [], inventoryRecords = [] }) {
  const update = (index, field, value) => {
    onChange(items.map((item, i) => i !== index ? item : calcRow({ ...item, [field]: value })))
  }

  const toggleCustom = (index, checked) => {
    onChange(items.map((item, i) => i !== index ? item : calcRow({
      ...item,
      is_custom: checked,
      material_type: '', material_id: null, material_name: '',
      unit: '', unit_price: 0, source: '', price_entry_date: null,
    })))
  }

  const updateMaterialType = (index, typeName) => {
    onChange(items.map((item, i) => i !== index ? item : calcRow({
      ...item,
      material_type: typeName,
      material_id: null, material_name: '', unit: '', unit_price: 0, source: '', price_entry_date: null,
    })))
  }

  // Selecting by id — never by name — so two materials sharing a name but
  // differing in material_type can never resolve to the wrong one.
  const updateMaterial = (index, materialId) => {
    const mat = materials.find(m => m.id === materialId)
    const inv = bestInventoryFor(materialId, inventoryRecords)
    const updated = {
      ...items[index],
      material_id: materialId,
      material_name: mat?.rating_size || '',
      material_type: items[index].material_type || mat?.material_type || '',
      unit: mat?.unit || '',
      unit_price: inv ? Number(inv.latest_unit_cost) || 0 : 0,
      source: inv?.latest_cost_supplier || '',
      price_entry_date: inv?.latest_cost_date || null,
    }
    onChange(items.map((item, i) => i !== index ? item : calcRow(updated)))
  }

  const addRow = () => onChange([...items, emptyBomRow()])
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i))
  const total = calcBomTotal(items)

  const activeTypes = materialTypes.filter(t => !t.archived)

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm min-w-[1400px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Custom', 'Material Type', 'Material', 'Unit', 'Qty', 'Price', 'Subtotal', 'Adj. %', 'Subtotal (Adj)', 'Source', 'Price Entry Date', ''].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((row, i) => {
              const filteredMaterials = row.material_type
                ? materials.filter(m => m.material_type === row.material_type)
                : materials
              const sourceMissing = row.is_custom && !row.source?.trim()

              return (
                <tr key={i} className="bg-white align-top">
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={!!row.is_custom} onChange={e => toggleCustom(i, e.target.checked)}
                      className="w-4 h-4 rounded accent-gray-800" />
                  </td>

                  <td className="px-2 py-1.5 min-w-[130px]">
                    {row.is_custom ? (
                      <input value={row.material_type} onChange={e => update(i, 'material_type', e.target.value)}
                        placeholder="Type" className={inp} />
                    ) : (
                      <select value={row.material_type} onChange={e => updateMaterialType(i, e.target.value)} className={inp}>
                        <option value="">All types</option>
                        {activeTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </select>
                    )}
                  </td>

                  <td className="px-2 py-1.5 min-w-[210px]">
                    {row.is_custom ? (
                      <input value={row.material_name} onChange={e => update(i, 'material_name', e.target.value)}
                        placeholder="Material name" className={inp} />
                    ) : (
                      <MaterialCombobox value={row.material_id} onValueChange={id => updateMaterial(i, id)} materials={filteredMaterials} />
                    )}
                  </td>

                  <td className="px-2 py-1.5 w-20">
                    <input value={row.unit} onChange={e => update(i, 'unit', e.target.value)}
                      disabled={!row.is_custom} placeholder="pcs" className={row.is_custom ? inp : roInp} />
                  </td>

                  <td className="px-2 py-1.5 w-20">
                    <input type="number" value={row.quantity} onChange={e => update(i, 'quantity', parseFloat(e.target.value) || 0)} className={inp} />
                  </td>

                  <td className="px-2 py-1.5 w-24">
                    <input type="number" value={row.unit_price} onChange={e => update(i, 'unit_price', parseFloat(e.target.value) || 0)}
                      disabled={!row.is_custom} title={!row.is_custom ? 'Auto-priced from inventory (top procurement entry)' : undefined}
                      className={row.is_custom ? inp : roInp} />
                  </td>

                  <td className="px-3 py-2.5 text-gray-700 font-medium whitespace-nowrap">{fmt(row.subtotal)}</td>

                  <td className="px-2 py-1.5 w-20">
                    <input type="number" min={0} max={100} value={row.adjustment_pct}
                      onChange={e => {
                        const raw = parseFloat(e.target.value)
                        const clamped = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 100
                        update(i, 'adjustment_pct', clamped)
                      }}
                      className={inp} />
                  </td>

                  <td className="px-3 py-2.5 text-gray-900 font-semibold whitespace-nowrap">{fmt(row.adjusted_subtotal)}</td>

                  <td className="px-2 py-1.5 min-w-[160px]">
                    {row.is_custom ? (
                      <input value={row.source} onChange={e => update(i, 'source', e.target.value)}
                        placeholder="Supplier (required)"
                        className={`${inp} ${sourceMissing ? 'border-red-400 bg-red-50 focus:ring-red-300' : ''}`} />
                    ) : (
                      <div className={roInp}>{row.source || '-'}</div>
                    )}
                  </td>

                  <td className="px-2 py-1.5 w-32">
                    <div className={roInp}>
                      {!row.is_custom && row.price_entry_date
                        ? format(new Date(row.price_entry_date + 'T00:00:00'), 'MMM d, yyyy')
                        : '-'}
                    </div>
                  </td>

                  <td className="px-2 py-1.5">
                    <button onClick={() => removeRow(i)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {items.length === 0 && (
              <tr><td colSpan={12} className="px-4 py-6 text-center text-gray-400 text-sm">No materials added yet.</td></tr>
            )}
            {items.length > 0 && (
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={8} className="px-3 py-2.5 text-right text-gray-600">BOM Total:</td>
                <td className="px-3 py-2.5 text-gray-900">{fmt(total)}</td>
                <td colSpan={3} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 text-gray-600">
        <Plus size={14} /> Add Material
      </button>
    </div>
  )
}
