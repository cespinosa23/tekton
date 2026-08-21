import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsUpDown, Check } from 'lucide-react'

export default function SupplierCombobox({ value, onValueChange, suppliers = [] }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const selected = suppliers.find(s => s.name === value)

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

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

  return (
    <div className="relative w-full">
      <button ref={btnRef} type="button" onClick={toggleOpen}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400">
        {selected ? (
          <span className="truncate">{selected.name}</span>
        ) : (
          <span className="text-gray-400">Select supplier...</span>
        )}
        <ChevronsUpDown size={15} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && rect && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="z-50 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search suppliers..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No supplier found.</div>
            ) : filtered.map(s => (
              <button key={s.id} type="button"
                onClick={() => { onValueChange(s.name); setOpen(false); setSearch('') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                <Check size={14} className={value === s.name ? 'text-gray-900' : 'opacity-0'} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  {s.contact_person && <p className="text-xs text-gray-400">{s.contact_person}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
