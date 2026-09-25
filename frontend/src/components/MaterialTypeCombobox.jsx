import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsUpDown, Check } from 'lucide-react'

// Searchable dropdown over the managed Material Types list (Settings > Material
// Types). Includes a pinned "All types" entry (value '') matching the plain
// <select> this replaces, which BOMEditor uses to clear the type filter on the
// Material combobox next to it — not a real type, so it's kept out of search
// filtering and always shown first.
export default function MaterialTypeCombobox({ value, onValueChange, types = [], disabled = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const selected = types.find(t => t.name === value)

  const filtered = types.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  // Fixed-position portal (not absolute inside this component) so the panel
  // floats above any scrollable ancestor (e.g. a horizontally-scrolling table)
  // instead of getting clipped by it.
  const updateRect = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setRect({ top: r.bottom + 4, left: r.left, width: r.width })
  }

  const toggleOpen = () => {
    if (!open) updateRect()
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (btnRef.current?.contains(e.target)) return
      if (panelRef.current?.contains(e.target)) return
      setOpen(false)
    }
    // capture:true — scroll doesn't bubble, so this is the only way to hear it
    // from an arbitrary scrollable ancestor, not just window itself.
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', updateRect, true)
    window.addEventListener('resize', updateRect)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', updateRect, true)
      window.removeEventListener('resize', updateRect)
    }
  }, [open])

  const choose = (name) => { onValueChange(name); setOpen(false); setSearch('') }

  return (
    <div className="relative w-full">
      <button ref={btnRef} type="button" onClick={toggleOpen} disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 ${
          disabled ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}>
        <span className={selected ? 'truncate' : 'text-gray-400'}>{selected ? selected.name : 'All types'}</span>
        <ChevronsUpDown size={15} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && rect && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="z-50 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search material types..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button type="button" onClick={() => choose('')}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
              <Check size={14} className={!value ? 'text-gray-900' : 'opacity-0'} />
              <span className="text-sm text-gray-500">All types</span>
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No material type found.</div>
            ) : filtered.map(t => (
              <button key={t.id} type="button" onClick={() => choose(t.name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                <Check size={14} className={value === t.name ? 'text-gray-900' : 'opacity-0'} />
                <span className="text-sm text-gray-900">{t.name}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
