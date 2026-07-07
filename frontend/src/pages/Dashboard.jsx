import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  format, startOfWeek, startOfMonth, startOfYear,
  endOfWeek, endOfMonth, endOfYear, eachDayOfInterval,
  isSameMonth, isToday, isSameDay, parseISO
} from 'date-fns'
import Layout from '../components/Layout'
import {
  getProjects, getTransactions, getEmployees, getAttendance,
  getCalendarDays, createCalendarDay, updateCalendarDay
} from '../api/dashboard'
import { useAuth } from '../context/AuthContext'
import { Calendar, FolderKanban, Banknote, Receipt, Users, ChevronLeft, ChevronRight, X, RefreshCw, AlertTriangle, TrendingDown, Clock, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const DATE_FILTERS = [
  { value: 'wtd', label: 'Week to Date' },
  { value: 'mtd', label: 'Month to Date' },
  { value: 'ytd', label: 'Year to Date' },
]

const DAY_TYPE_COLORS = {
  Holiday: 'bg-red-100 text-red-700',
  Sunday: 'bg-slate-100 text-slate-500',
  'Work Suspended': 'bg-amber-100 text-amber-700',
  'Working Day': 'bg-emerald-100 text-emerald-700',
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [dateFilter, setDateFilter] = useState('mtd')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [dayType, setDayType] = useState('Working Day')
  const [dayDescription, setDayDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [importingHolidays, setImportingHolidays] = useState(false)
  const [phHolidays, setPhHolidays] = useState({}) // key: yyyy -> [{date, localName}]

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: getTransactions })
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees })
  const { data: calendarDays = [] } = useQuery({ queryKey: ['calendarDays'], queryFn: getCalendarDays })
  const { data: attendance = [] } = useQuery({ queryKey: ['attendance'], queryFn: getAttendance })

  // Fetch PH holidays when year changes
  useEffect(() => {
    const year = calendarMonth.getFullYear()
    if (phHolidays[year]) return // already fetched

    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/PH`)
      .then(res => res.json())
      .then(data => {
        setPhHolidays(prev => ({ ...prev, [year]: data }))
      })
      .catch(() => {}) // silently fail if offline
  }, [calendarMonth.getFullYear()])

  const getDateRange = () => {
    const now = new Date()
    switch (dateFilter) {
      case 'wtd': return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
      case 'ytd': return { start: startOfYear(now), end: endOfYear(now) }
      default: return { start: startOfMonth(now), end: endOfMonth(now) }
    }
  }

  const filterByDateRange = (items, dateField) => {
    const { start, end } = getDateRange()
    return items.filter(item => {
      const d = item[dateField] ? new Date(item[dateField]) : null
      return d && d >= start && d <= end
    })
  }

  const calculateWorkingDays = () => {
    const { start, end } = getDateRange()
    const days = eachDayOfInterval({ start, end })
    return days.filter(day => {
      const entry = calendarDays.find(cd => cd.date && isSameDay(parseISO(cd.date), day))
      if (entry) return entry.day_type === 'Working Day'
      return day.getDay() !== 0
    }).length
  }

  const filteredTransactions = filterByDateRange(transactions, 'transaction_date')
  const totalPayments = filteredTransactions
    .filter(t => t.transaction_type === 'Payment')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
  const totalMaterials = filteredTransactions
    .filter(t => t.transaction_type === 'Materials Procurement')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
  const totalGeneral = filteredTransactions
    .filter(t => t.transaction_type === 'General Expenditure')
    .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
  const totalLabor = filterByDateRange(attendance, 'date')
    .reduce((sum, a) => sum + (parseFloat(a.total_salary) || 0), 0)
  const totalExpenses = totalMaterials + totalGeneral + totalLabor

  const activeProjects = projects.filter(p => p.status === 'Active').length
  const activeEmployees = employees.filter(e => e.status === 'Active').length

  const { isAdmin, hasRole } = useAuth()
  const canSeeFinancials = isAdmin()
  const canSeeTotalExpenses = isAdmin() || hasRole('Project Coordinator') || hasRole('Project Manager')

  // Admin-only tracking widgets
  const adminWidgets = (() => {
    if (!isAdmin()) return { arProjects: [], overrunProjects: [], staleProjects: [] }
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30)
    const activeProjs = projects.filter(p => p.status === 'Active')
    const arList = [], overrunList = [], staleList = []
    activeProjs.forEach(project => {
      const projectTx = transactions.filter(t => t.project_id === project.id)
      const projectAtt = attendance.filter(a => a.project_id === project.id)
      const contractCost = parseFloat(project.contract_cost) || 0
      const encumbrance = parseFloat(project.encumbrance) || 0
      const totalContract = contractCost + encumbrance
      const laborCost = projectAtt.reduce((s, a) => s + (parseFloat(a.total_salary) || 0), 0)
      const materialsCost = projectTx
        .filter(t => ['Materials Procurement', 'Outgoing Materials', 'Incoming Materials'].includes(t.transaction_type))
        .reduce((s, t) => {
          const sign = t.transaction_type === 'Incoming Materials' ? -1 : 1
          return s + sign * (t.materials?.reduce((ms, m) => ms + (parseFloat(m.total_cost) || 0), 0) || 0)
        }, 0)
      const othersCost = projectTx
        .filter(t => t.transaction_type === 'General Expenditure')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
      const totalExpenses = laborCost + materialsCost + othersCost
      const totalPaid = projectTx
        .filter(t => t.transaction_type === 'Payment')
        .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
      const outstanding = totalContract - totalPaid
      if (outstanding > 0) arList.push({ ...project, outstanding, totalContract, totalPaid })
      if (totalContract > 0 && totalExpenses / totalContract >= 0.8) {
        overrunList.push({ ...project, overrunPct: totalExpenses / totalContract, totalExpenses, totalContract })
      }
      const lastTxMs = projectTx.length ? Math.max(...projectTx.map(t => new Date(t.transaction_date || 0).getTime())) : 0
      const lastAttMs = projectAtt.length ? Math.max(...projectAtt.map(a => new Date(a.date || 0).getTime())) : 0
      const lastMs = Math.max(lastTxMs, lastAttMs)
      if (!lastMs || new Date(lastMs) < cutoff) {
        staleList.push({ ...project, lastActivity: lastMs ? new Date(lastMs) : null })
      }
    })
    arList.sort((a, b) => b.outstanding - a.outstanding)
    overrunList.sort((a, b) => b.overrunPct - a.overrunPct)
    return { arProjects: arList, overrunProjects: overrunList, staleProjects: staleList }
  })()

  const projectPipeline = (() => {
    const counts = {}
    projects.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1 })
    const order = ['Active', 'Completed', 'On Hold', 'Cancelled', 'Inactive']
    const palette = { Active: '#10b981', Completed: '#3b82f6', 'On Hold': '#f59e0b', Cancelled: '#ef4444', Inactive: '#9ca3af' }
    const entries = Object.entries(counts).sort((a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99))
    const max = Math.max(...entries.map(([, n]) => n), 1)
    return { entries, max, palette, total: projects.length }
  })()

  // Check if a date is a PH holiday
  const getPhHoliday = (date) => {
    const year = date.getFullYear()
    const holidays = phHolidays[year] || []
    const dateStr = format(date, 'yyyy-MM-dd')
    return holidays.find(h => h.date === dateStr)
  }

  const getDayTypeColor = (date) => {
    const entry = calendarDays.find(cd => cd.date && isSameDay(parseISO(cd.date), date))
    if (entry) return DAY_TYPE_COLORS[entry.day_type] || ''
    // Check PH holiday
    if (getPhHoliday(date)) return DAY_TYPE_COLORS.Holiday
    return date.getDay() === 0 ? DAY_TYPE_COLORS.Sunday : DAY_TYPE_COLORS['Working Day']
  }

  const getDayTooltip = (date) => {
    const entry = calendarDays.find(cd => cd.date && isSameDay(parseISO(cd.date), date))
    if (entry?.description) return entry.description
    const phHoliday = getPhHoliday(date)
    if (phHoliday) return phHoliday.localName
    return ''
  }

  const handleDateClick = (date) => {
    setSelectedDate(date)
    const existing = calendarDays.find(cd => cd.date && isSameDay(parseISO(cd.date), date))
    if (existing) {
      setDayType(existing.day_type || 'Working Day')
      setDayDescription(existing.description || '')
    } else {
      // Pre-fill from PH holiday if available
      const phHoliday = getPhHoliday(date)
      if (phHoliday) {
        setDayType('Holiday')
        setDayDescription(phHoliday.localName)
      } else {
        setDayType('Working Day')
        setDayDescription('')
      }
    }
  }

  const handleSaveDayType = async () => {
    setSaving(true)
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    const existing = calendarDays.find(cd => cd.date === dateStr)
    try {
      if (existing) {
        await updateCalendarDay({ id: existing.id, data: { day_type: dayType, description: dayDescription } })
      } else {
        await createCalendarDay({ date: dateStr, day_type: dayType, description: dayDescription })
      }
      queryClient.invalidateQueries({ queryKey: ['calendarDays'] })
      setSelectedDate(null)
    } finally {
      setSaving(false)
    }
  }

  // Import all PH holidays for the current calendar month's year
  const handleImportHolidays = async () => {
    const year = calendarMonth.getFullYear()
    const holidays = phHolidays[year] || []
    if (holidays.length === 0) return

    setImportingHolidays(true)
    try {
      for (const holiday of holidays) {
        const existing = calendarDays.find(cd => cd.date === holiday.date)
        if (!existing) {
          await createCalendarDay({
            date: holiday.date,
            day_type: 'Holiday',
            description: holiday.localName,
          })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['calendarDays'] })
    } finally {
      setImportingHolidays(false)
    }
  }

  const calendarDaysInMonth = eachDayOfInterval({
    start: startOfMonth(calendarMonth),
    end: endOfMonth(calendarMonth),
  })
  const startPadding = Array(startOfMonth(calendarMonth).getDay()).fill(null)

  const stats = [
    { label: 'Working Days', value: calculateWorkingDays(), icon: Calendar, color: 'bg-blue-500', clickable: true },
    { label: 'Active Projects', value: activeProjects, icon: FolderKanban, color: 'bg-emerald-500' },
    ...(canSeeFinancials ? [
      { label: 'Total Payments Received', value: `₱${totalPayments.toLocaleString()}`, icon: Banknote, color: 'bg-green-500' },
    ] : []),
    ...(canSeeTotalExpenses ? [
      { label: 'Total Expenses', value: `₱${totalExpenses.toLocaleString()}`, icon: Receipt, color: 'bg-red-500' },
    ] : []),
    { label: 'Active Employees', value: activeEmployees, icon: Users, color: 'bg-violet-500' },
  ]

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Overview of Tekton Electrical Services operations</p>
          </div>
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            {DATE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {/* Stat cards */}
        <div className={`grid gap-4 ${canSeeFinancials ? 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-5' : canSeeTotalExpenses ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
          {stats.map(({ label, value, icon: Icon, color, clickable }) => (
            <div
              key={label}
              onClick={clickable ? () => setCalendarOpen(true) : undefined}
              className={`bg-white rounded-lg border border-gray-200 p-5 ${clickable ? 'cursor-pointer hover:border-gray-300 transition-colors' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-2">{label}</p>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                </div>
                <div className={`${color} p-2 rounded-lg`}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Admin overview — replaces chart section */}
        {isAdmin() && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Operations Overview</h2>
              <Link to="/reports" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                View full analytics →
              </Link>
            </div>

            {/* Row 1: Project Pipeline + Period Financials */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Project Pipeline */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-700 mb-4">Project Pipeline</p>
                {projectPipeline.entries.length === 0 ? (
                  <p className="text-sm text-gray-400">No projects yet</p>
                ) : (
                  <div className="space-y-3">
                    {projectPipeline.entries.map(([status, count]) => (
                      <div key={status}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">{status}</span>
                          <span className="font-semibold text-gray-900">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(count / projectPipeline.max) * 100}%`,
                              background: projectPipeline.palette[status] || '#9ca3af',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400 pt-1">{projectPipeline.total} projects total</p>
                  </div>
                )}
              </div>

              {/* Period Financials */}
              <div className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-700">Period Financials</p>
                  <span className="text-xs text-gray-400">{DATE_FILTERS.find(f => f.value === dateFilter)?.label}</span>
                </div>

                {/* Net figure */}
                <div className={`mb-4 px-4 py-3 rounded-lg ${(totalPayments - totalExpenses) >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <p className="text-xs text-gray-500 mb-0.5">{(totalPayments - totalExpenses) >= 0 ? 'Net Gain' : 'Net Loss'}</p>
                  <p className={`text-2xl font-bold ${(totalPayments - totalExpenses) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    ₱{Math.abs(totalPayments - totalExpenses).toLocaleString()}
                  </p>
                </div>

                {/* Revenue vs Expenses */}
                <div className="space-y-2 mb-4">
                  {[
                    { label: 'Revenue', value: totalPayments, bar: 'bg-emerald-400' },
                    { label: 'Expenses', value: totalExpenses, bar: 'bg-red-400' },
                  ].map(({ label, value, bar }) => {
                    const max = Math.max(totalPayments, totalExpenses, 1)
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-medium text-gray-800">₱{value.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${bar}`} style={{ width: `${(value / max) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Expense breakdown */}
                {totalExpenses > 0 && (
                  <div className="border-t border-gray-100 pt-3 space-y-1.5">
                    <p className="text-xs text-gray-400 mb-2">Expense breakdown</p>
                    {[
                      { label: 'Labor', value: totalLabor, dot: 'bg-amber-400' },
                      { label: 'Materials', value: totalMaterials, dot: 'bg-blue-400' },
                      { label: 'General', value: totalGeneral, dot: 'bg-violet-400' },
                    ].filter(e => e.value > 0).map(({ label, value, dot }) => {
                      const pct = Math.round((value / totalExpenses) * 100)
                      return (
                        <div key={label} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <span className={`w-2 h-2 rounded-full ${dot}`} />
                            {label}
                          </span>
                          <span className="text-gray-500">₱{value.toLocaleString()} <span className="text-gray-400">({pct}%)</span></span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Alert widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Accounts Receivable */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                  <Banknote size={16} className="text-emerald-600" />
                  <h3 className="text-sm font-medium text-gray-700">Accounts Receivable</h3>
                  <span className="ml-auto bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {adminWidgets.arProjects.length}
                  </span>
                </div>
                {adminWidgets.arProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <CheckCircle2 size={24} className="mb-2 text-emerald-400" />
                    <span className="text-xs">All payments settled</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {adminWidgets.arProjects.map(p => {
                      const pct = p.totalContract > 0 ? (p.totalPaid / p.totalContract) * 100 : 0
                      return (
                        <div key={p.id} className="px-5 py-3">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{p.project_name}</p>
                              <p className="text-xs text-gray-400 truncate">{p.owner_company_name}</p>
                            </div>
                            <span className="text-xs font-bold text-red-600 whitespace-nowrap">
                              ₱{p.outstanding.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(0)}% collected</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Cost Overrun Alerts */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                  <TrendingDown size={16} className="text-red-500" />
                  <h3 className="text-sm font-medium text-gray-700">Cost Overruns</h3>
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${adminWidgets.overrunProjects.length > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'}`}>
                    {adminWidgets.overrunProjects.length}
                  </span>
                </div>
                {adminWidgets.overrunProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <CheckCircle2 size={24} className="mb-2 text-emerald-400" />
                    <span className="text-xs">All projects within budget</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {adminWidgets.overrunProjects.map(p => {
                      const isOver = p.overrunPct >= 1
                      return (
                        <div key={p.id} className={`px-5 py-3 ${isOver ? 'bg-red-50/40' : 'bg-amber-50/30'}`}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-900 truncate">{p.project_name}</p>
                              <p className="text-xs text-gray-400 truncate">{p.owner_company_name}</p>
                            </div>
                            <span className={`flex items-center gap-1 text-xs font-bold whitespace-nowrap ${isOver ? 'text-red-600' : 'text-amber-600'}`}>
                              <AlertTriangle size={11} />
                              {(p.overrunPct * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${isOver ? 'bg-red-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(p.overrunPct * 100, 100)}%` }} />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            ₱{p.totalExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })} of ₱{p.totalContract.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Stale Projects */}
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                  <Clock size={16} className="text-amber-500" />
                  <h3 className="text-sm font-medium text-gray-700">Stale Projects</h3>
                  <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${adminWidgets.staleProjects.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-gray-50 text-gray-500'}`}>
                    {adminWidgets.staleProjects.length}
                  </span>
                </div>
                {adminWidgets.staleProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <CheckCircle2 size={24} className="mb-2 text-emerald-400" />
                    <span className="text-xs">All projects have recent activity</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                    {adminWidgets.staleProjects.map(p => (
                      <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-900 truncate">{p.project_name}</p>
                          <p className="text-xs text-gray-400 truncate">{p.project_manager || '—'}</p>
                        </div>
                        <span className="text-xs font-semibold text-amber-600 whitespace-nowrap">
                          {p.lastActivity ? `${Math.floor((new Date() - p.lastActivity) / 86400000)}d ago` : 'No activity'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Calendar Modal */}
        {calendarOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Working Days Calendar</h2>
                <button onClick={() => setCalendarOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4">
                {/* Month nav + Import button */}
                <div className="flex items-center justify-between mb-4">
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}
                    className="p-1.5 rounded hover:bg-gray-100"><ChevronLeft size={16} /></button>
                  <span className="font-semibold text-gray-900">{format(calendarMonth, 'MMMM yyyy')}</span>
                  <button onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}
                    className="p-1.5 rounded hover:bg-gray-100"><ChevronRight size={16} /></button>
                </div>

                {/* Import PH Holidays button */}
                <div className="mb-4">
                  <button
                    onClick={handleImportHolidays}
                    disabled={importingHolidays || !phHolidays[calendarMonth.getFullYear()]}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors">
                    <RefreshCw size={13} className={importingHolidays ? 'animate-spin' : ''} />
                    {importingHolidays ? 'Importing...' : `Import PH Holidays for ${calendarMonth.getFullYear()}`}
                  </button>
                  <p className="text-xs text-gray-400 mt-1">Only adds holidays not yet marked. Existing entries are preserved.</p>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-xs font-medium text-gray-400 py-1">{d}</div>
                  ))}
                </div>

                {/* Days */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {startPadding.map((_, i) => <div key={`pad-${i}`} />)}
                  {calendarDaysInMonth.map(date => {
                    const tooltip = getDayTooltip(date)
                    return (
                      <button key={date.toISOString()} onClick={() => handleDateClick(date)}
                        title={tooltip}
                        className={`p-2 text-sm rounded-lg transition-all hover:opacity-80 ${isToday(date) ? 'ring-2 ring-gray-900' : ''} ${getDayTypeColor(date)}`}>
                        {format(date, 'd')}
                      </button>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
                  {[['bg-emerald-100', 'Working'], ['bg-red-100', 'Holiday'], ['bg-slate-100', 'Sunday'], ['bg-amber-100', 'Suspended']].map(([cls, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded ${cls}`} />
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Day Type Editor */}
        {selectedDate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
              {getPhHoliday(selectedDate) && !calendarDays.find(cd => cd.date === format(selectedDate, 'yyyy-MM-dd')) && (
                <p className="text-xs text-red-500 mb-3">
                  🇵🇭 PH Holiday: {getPhHoliday(selectedDate).localName}
                </p>
              )}
              <div className="space-y-3 mb-4">
                {['Working Day', 'Holiday', 'Work Suspended'].map(type => (
                  <label key={type} className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="dayType" value={type} checked={dayType === type}
                      onChange={() => setDayType(type)} className="w-4 h-4" />
                    <span className="text-sm text-gray-700">{type}</span>
                  </label>
                ))}
              </div>
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-700 mb-1">Description (optional)</label>
                <input value={dayDescription} onChange={e => setDayDescription(e.target.value)}
                  placeholder="e.g., National Holiday"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setSelectedDate(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleSaveDayType} disabled={saving}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}