import { useState, useRef, useEffect } from 'react'
import { ChevronsUpDown, Check } from 'lucide-react'

export default function MaterialCombobox({ value, onValueChange, materials = [] }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const selected = materials.find(m => m.id === value)

  const filtered = materials.filter(m =>
    `${m.rating_size} ${m.material_type || ''} ${m.brand || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400">
        {selected ? (
          <span className="truncate text-left">{selected.rating_size}</span>
        ) : (
          <span className="text-gray-400">Select material...</span>
        )}
        <ChevronsUpDown size={15} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search materials..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No material found.</div>
            ) : filtered.map(mat => (
              <button key={mat.id} type="button"
                onClick={() => { onValueChange(mat.id); setOpen(false); setSearch('') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                <Check size={14} className={value === mat.id ? 'text-gray-900' : 'opacity-0'} />
                <p className="text-sm text-gray-900">{mat.rating_size}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}