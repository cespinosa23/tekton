import { Plus, Trash2 } from 'lucide-react'

const empty = () => ({
  material: '', quantity: 1, unit: '', unit_price: 0, markup_pct: 0,
  adjusted_unit_price: 0, subtotal: 0,
})

function calcRow(row) {
  const adj = Number(row.unit_price || 0) * (1 + Number(row.markup_pct || 0) / 100)
  const sub = Number(row.quantity || 0) * adj
  return { ...row, adjusted_unit_price: Math.round(adj * 100) / 100, subtotal: Math.round(sub * 100) / 100 }
}

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const inp = 'px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 w-full'

export default function BOMEditor({ items = [], onChange, materials = [] }) {
  const update = (index, field, value) => {
    onChange(items.map((item, i) => i !== index ? item : calcRow({ ...item, [field]: value })))
  }

  const updateMaterial = (index, value) => {
    const mat = materials.find(m => m.rating_size === value)
    const updated = { ...items[index], material: value }
    if (mat) updated.unit = mat.unit
    onChange(items.map((item, i) => i !== index ? item : calcRow(updated)))
  }

  const addRow = () => onChange([...items, empty()])
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i))
  const total = items.reduce((s, r) => s + (r.subtotal || 0), 0)

  return (
    <div className="space-y-3">
      {/* Datalist for material autocomplete */}
      <datalist id="bom-materials-list">
        {materials.map(m => (
          <option key={m.id} value={m.rating_size} />
        ))}
      </datalist>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Material', 'Qty', 'Unit', 'Unit Price', 'Markup %', 'Adj. Unit Price', 'Subtotal', ''].map(h => (
                <th key={h} className="text-left px-3 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((row, i) => (
              <tr key={i} className="bg-white">
                <td className="px-2 py-1.5">
                  <input
                    value={row.material}
                    list="bom-materials-list"
                    onChange={e => updateMaterial(i, e.target.value)}
                    className={`${inp} min-w-[180px]`}
                    placeholder="Material or type to search…"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={row.quantity} onChange={e => update(i, 'quantity', parseFloat(e.target.value) || 0)} className={`${inp} w-16`} />
                </td>
                <td className="px-2 py-1.5">
                  <input value={row.unit} onChange={e => update(i, 'unit', e.target.value)} className={`${inp} w-16`} placeholder="pcs" />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={row.unit_price} onChange={e => update(i, 'unit_price', parseFloat(e.target.value) || 0)} className={`${inp} w-28`} />
                </td>
                <td className="px-2 py-1.5">
                  <input type="number" value={row.markup_pct} onChange={e => update(i, 'markup_pct', parseFloat(e.target.value) || 0)} className={`${inp} w-16`} />
                </td>
                <td className="px-3 py-1.5 text-gray-700 font-medium whitespace-nowrap">{fmt(row.adjusted_unit_price)}</td>
                <td className="px-3 py-1.5 text-gray-900 font-semibold whitespace-nowrap">{fmt(row.subtotal)}</td>
                <td className="px-2 py-1.5">
                  <button onClick={() => removeRow(i)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400 text-sm">No materials added yet.</td></tr>
            )}
            {items.length > 0 && (
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={6} className="px-3 py-2.5 text-right text-gray-600">BOM Total:</td>
                <td className="px-3 py-2.5 text-gray-900">{fmt(total)}</td>
                <td />
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
