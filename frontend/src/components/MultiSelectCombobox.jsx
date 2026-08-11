import { useState, useRef, useEffect } from 'react'
import { ChevronsUpDown, Check, X } from 'lucide-react'

export default function MultiSelectCombobox({
  options = [], selectedIds = [], onChange, placeholder = 'Select...',
  getLabel = (o) => o.name, getId = (o) => o.id, disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  const selectedSet = new Set(selectedIds)
  const selectedOptions = options.filter(o => selectedSet.has(getId(o)))
  const filtered = options.filter(o => getLabel(o).toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const toggle = (id) => {
    if (disabled) return
    onChange(selectedSet.has(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id])
  }

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" disabled={disabled} onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed">
        <span className={selectedOptions.length ? 'text-gray-900' : 'text-gray-400'}>
          {selectedOptions.length ? `${selectedOptions.length} selected` : placeholder}
        </span>
        <ChevronsUpDown size={15} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400" />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No results found.</div>
            ) : filtered.map(opt => {
              const id = getId(opt)
              const checked = selectedSet.has(id)
              return (
                <button key={id} type="button" onClick={() => toggle(id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                  <span className={`flex items-center justify-center w-4 h-4 rounded border flex-shrink-0 ${checked ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                    {checked && <Check size={11} className="text-white" />}
                  </span>
                  <span className="text-sm text-gray-800">{getLabel(opt)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedOptions.map(opt => {
            const id = getId(opt)
            return (
              <span key={id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-700">
                {getLabel(opt)}
                {!disabled && (
                  <button type="button" onClick={() => toggle(id)} className="text-gray-400 hover:text-red-500">
                    <X size={11} />
                  </button>
                )}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
