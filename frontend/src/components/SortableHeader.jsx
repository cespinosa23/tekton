import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

export function SortableHeader({ label, field, sortKey, sortDir, onSort, className = '', align = 'left' }) {
  const active = sortKey === field
  return (
    <th
      onClick={() => onSort(field)}
      className={`cursor-pointer select-none group ${className}`}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <span className={active ? 'text-gray-700' : 'text-gray-300 group-hover:text-gray-400'}>
          {active
            ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
            : <ChevronsUpDown size={12} />
          }
        </span>
      </div>
    </th>
  )
}
