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
import { Calendar, FolderKanban, Banknote, Receipt, Users, ChevronLeft, ChevronRight, X, RefreshCw } from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'

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

  // Last 6 months of monthly data for charts
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    const yr = d.getFullYear()
    const mo = d.getMonth()
    const inMonth = (dateStr) => {
      if (!dateStr) return false
      const dd = new Date(dateStr)
      return dd.getFullYear() === yr && dd.getMonth() === mo
    }
    const revenue = transactions
      .filter(t => t.transaction_type === 'Payment' && inMonth(t.transaction_date))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
    const labor = attendance
      .filter(a => inMonth(a.date))
      .reduce((sum, a) => sum + (parseFloat(a.total_salary) || 0), 0)
    const materials = transactions
      .filter(t => t.transaction_type === 'Materials Procurement' && inMonth(t.transaction_date))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
    const general = transactions
      .filter(t => t.transaction_type === 'General Expenditure' && inMonth(t.transaction_date))
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)
    return {
      month: format(d, 'MMM yy'),
      revenue,
      labor,
      materials,
      general,
      net: revenue - labor - materials - general,
    }
  })

  const activeProjects = projects.filter(p => p.status === 'Active').length
  const activeEmployees = employees.filter(e => e.status === 'Active').length

  const { isAdmin, hasRole } = useAuth()
  const canSeeFinancials = isAdmin()
  const canSeeTotalExpenses = isAdmin() || hasRole('Project Coordinator') || hasRole('Project Manager')

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

        {/* Financial Analysis — Admin only */}
        {isAdmin() && (
          <div className="mt-8">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Financial Analysis</h2>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

              {/* Monthly Revenue vs Expenses */}
              <div className="xl:col-span-2 bg-white rounded-lg border border-gray-200 p-5">
                <p className="text-sm font-medium text-gray-700 mb-1">Revenue vs Expenses — Last 6 Months</p>
                <p className="text-xs text-gray-400 mb-4">Bars show cost breakdown; line shows net profit / loss</p>
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `₱${(v/1000).toFixed(0)}k` : `₱${v}`} width={56} />
                    <Tooltip
                      formatter={(value, name) => [`₱${value.toLocaleString()}`, name]}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="4 2" />
                    <Bar dataKey="labor" name="Labor" stackId="exp" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="materials" name="Materials" stackId="exp" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="general" name="General" stackId="exp" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="net" name="Net Profit" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Expense Breakdown donut */}
              <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
                <p className="text-sm font-medium text-gray-700 mb-1">Expense Breakdown</p>
                <p className="text-xs text-gray-400 mb-4">Current period ({DATE_FILTERS.find(f => f.value === dateFilter)?.label})</p>
                {(totalLabor + totalMaterials + totalGeneral) === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-gray-400">No expenses recorded</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Labor', value: totalLabor, color: '#f59e0b' },
                            { name: 'Materials', value: totalMaterials, color: '#3b82f6' },
                            { name: 'General', value: totalGeneral, color: '#8b5cf6' },
                          ].filter(e => e.value > 0)}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={80}
                          dataKey="value"
                        >
                          {[
                            { name: 'Labor', value: totalLabor, color: '#f59e0b' },
                            { name: 'Materials', value: totalMaterials, color: '#3b82f6' },
                            { name: 'General', value: totalGeneral, color: '#8b5cf6' },
                          ].filter(e => e.value > 0).map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₱${value.toLocaleString()}`} contentStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-2">
                      {[
                        { label: 'Labor', value: totalLabor, color: 'bg-amber-400' },
                        { label: 'Materials', value: totalMaterials, color: 'bg-blue-500' },
                        { label: 'General', value: totalGeneral, color: 'bg-violet-500' },
                      ].filter(e => e.value > 0).map(({ label, value, color }) => {
                        const total = totalLabor + totalMaterials + totalGeneral
                        const pct = total > 0 ? Math.round((value / total) * 100) : 0
                        const warn = label === 'Labor' && pct > 50
                        return (
                          <div key={label} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                              <span className="text-gray-600">{label}</span>
                              {warn && <span className="text-amber-600 font-medium">High</span>}
                            </div>
                            <div className="text-right">
                              <span className="font-medium text-gray-800">₱{value.toLocaleString()}</span>
                              <span className="text-gray-400 ml-1">({pct}%)</span>
                            </div>
                          </div>
                        )
                      })}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs font-semibold text-gray-700">
                        <span>Total Expenses</span>
                        <span>₱{(totalLabor + totalMaterials + totalGeneral).toLocaleString()}</span>
                      </div>
                      <div className={`flex items-center justify-between text-xs font-semibold pt-1 ${(totalPayments - totalExpenses) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        <span>{(totalPayments - totalExpenses) >= 0 ? 'Net Gain' : 'Net Loss'}</span>
                        <span>₱{Math.abs(totalPayments - totalExpenses).toLocaleString()}</span>
                      </div>
                    </div>
                  </>
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