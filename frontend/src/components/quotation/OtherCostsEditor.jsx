import { Plus, Trash2 } from 'lucide-react'

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const inp = 'px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'

export default function OtherCostsEditor({ items = [], onChange }) {
  const update = (i, field, value) => {
    onChange(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))
  }
  const addRow = () => onChange([...items, { description: '', amount: 0 }])
  const removeRow = (i) => onChange(items.filter((_, idx) => idx !== i))
  const total = items.reduce((s, r) => s + (Number(r.amount) || 0), 0)

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-sm text-gray-400 py-4 text-center">No additional costs added.</p>
      )}
      {items.map((row, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            placeholder="Description"
            value={row.description}
            onChange={e => update(i, 'description', e.target.value)}
            className={`${inp} flex-1`}
          />
          <input
            type="number"
            placeholder="Amount"
            value={row.amount}
            onChange={e => update(i, 'amount', parseFloat(e.target.value) || 0)}
            className={`${inp} w-36`}
          />
          <button onClick={() => removeRow(i)} className="p-2 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {items.length > 0 && (
        <p className="text-right text-sm font-semibold text-gray-700 pr-10">Total: {fmt(total)}</p>
      )}
      <button onClick={addRow} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 text-gray-600 mt-2">
        <Plus size={14} /> Add Cost
      </button>
    </div>
  )
}
