import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronsUpDown, Check } from 'lucide-react'

const fullName = (e) => [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ')

export default function EmployeeCombobox({ value, onValueChange, employees = [], disabled = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const panelRef = useRef(null)

  const selected = employees.find(e => e.id === value)

  const filtered = employees.filter(e =>
    `${fullName(e)} ${e.department || ''} ${e.role || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  // Fixed-position portal (not absolute inside this component) so the panel
  // floats above any scrollable ancestor instead of getting clipped by it.
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
      <button ref={btnRef} type="button" onClick={toggleOpen} disabled={disabled}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 ${
          disabled ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}>
        {selected ? (
          <span className="truncate text-left">{fullName(selected)}</span>
        ) : (
          <span className="text-gray-400">Select employee...</span>
        )}
        <ChevronsUpDown size={15} className="text-gray-400 flex-shrink-0 ml-2" />
      </button>

      {open && rect && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width }}
          className="z-50 bg-white border border-gray-200 rounded-md shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400" />
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">No employee found.</div>
            ) : filtered.map(emp => (
              <button key={emp.id} type="button"
                onClick={() => { onValueChange(emp.id); setOpen(false); setSearch('') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50">
                <Check size={14} className={value === emp.id ? 'text-gray-900' : 'opacity-0'} />
                <div>
                  <p className="text-sm text-gray-900">{fullName(emp)}</p>
                  {(emp.department || emp.role) && (
                    <p className="text-xs text-gray-400">{[emp.department, emp.role].filter(Boolean).join(' · ')}</p>
                  )}
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
