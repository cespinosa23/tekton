import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  addWeeks, addMonths, addYears,
} from 'date-fns'

// Period selection shared by list screens that fetch one period at a time.
// Weeks start on Monday, matching the Attendance and Dashboard views.
export const PERIODS = [
  { value: 'week', label: 'By week' },
  { value: 'month', label: 'By month' },
  { value: 'year', label: 'By year' },
  { value: 'all', label: 'All' },
]

const ymd = (d) => format(d, 'yyyy-MM-dd')

// { start, end } as 'yyyy-MM-dd' (inclusive) for the period containing `anchor`;
// both undefined for 'all' (no date filter).
export function periodRange(kind, anchor = new Date()) {
  switch (kind) {
    case 'week': return { start: ymd(startOfWeek(anchor, { weekStartsOn: 1 })), end: ymd(endOfWeek(anchor, { weekStartsOn: 1 })) }
    case 'month': return { start: ymd(startOfMonth(anchor)), end: ymd(endOfMonth(anchor)) }
    case 'year': return { start: ymd(startOfYear(anchor)), end: ymd(endOfYear(anchor)) }
    default: return { start: undefined, end: undefined }
  }
}

export function periodLabel(kind, anchor = new Date()) {
  switch (kind) {
    case 'week': {
      const s = startOfWeek(anchor, { weekStartsOn: 1 }), e = endOfWeek(anchor, { weekStartsOn: 1 })
      return s.getFullYear() === e.getFullYear()
        ? `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`
        : `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`
    }
    case 'month': return format(anchor, 'MMMM yyyy')
    case 'year': return format(anchor, 'yyyy')
    default: return 'All dates'
  }
}

// Anchor moved one period back (-1) or forward (+1).
export function shiftPeriod(kind, anchor, dir) {
  if (kind === 'week') return addWeeks(anchor, dir)
  if (kind === 'month') return addMonths(anchor, dir)
  if (kind === 'year') return addYears(anchor, dir)
  return anchor
}
