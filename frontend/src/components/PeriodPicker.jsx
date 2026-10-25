import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PERIODS, periodLabel, shiftPeriod } from '../lib/period'

// By week / By month / By year / All, with ◀ ▶ to step through periods and a
// "Today" jump. Controlled: the parent keeps { kind, anchor } and fetches
// periodRange(kind, anchor).
export default function PeriodPicker({ kind, anchor, onChange }) {
  const stepping = kind !== 'all'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select value={kind} onChange={e => onChange({ kind: e.target.value, anchor })}
        className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
        {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      {stepping && (
        <div className="flex items-center border border-gray-300 rounded-md bg-white">
          <button onClick={() => onChange({ kind, anchor: shiftPeriod(kind, anchor, -1) })}
            className="p-2 text-gray-500 hover:text-gray-800" title="Previous"><ChevronLeft size={15} /></button>
          <span className="px-2 text-sm text-gray-700 whitespace-nowrap min-w-[9rem] text-center">{periodLabel(kind, anchor)}</span>
          <button onClick={() => onChange({ kind, anchor: shiftPeriod(kind, anchor, 1) })}
            className="p-2 text-gray-500 hover:text-gray-800" title="Next"><ChevronRight size={15} /></button>
        </div>
      )}
      {stepping && (
        <button onClick={() => onChange({ kind, anchor: new Date() })}
          className="text-xs text-gray-500 hover:text-gray-800 underline">Today</button>
      )}
    </div>
  )
}
