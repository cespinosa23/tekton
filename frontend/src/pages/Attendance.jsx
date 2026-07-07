import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addWeeks, addMonths, addYears } from 'date-fns'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import {
  getAttendance, getEmployees, getProjects,
  createAttendance, updateAttendance, deleteAttendance
} from '../api/attendance'
import { Plus, ChevronLeft, ChevronRight, Calendar, Building2, Pencil, Trash2, X, Clock, DollarSign, Users, CalendarCheck, Search } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../context/AuthContext'
import { useSortable } from '../hooks/useSortable'
import { SortableHeader } from '../components/SortableHeader'

const STATUS_COLORS = {
  Present: 'bg-emerald-100 text-emerald-700',
  Absent: 'bg-red-100 text-red-700',
  'Half-day': 'bg-amber-100 text-amber-700',
  Leave: 'bg-blue-100 text-blue-700',
}

const emptyForm = {
  employee_id: '',
  employee_name: '',
  is_office_based: false,
  project_id: '',
  project_name: '',
  date: format(new Date(), 'yyyy-MM-dd'),
  regular_time_in: '08:00',
  regular_time_out: '17:00',
  regular_hours: 8,
  overtime_time_in: '',
  overtime_time_out: '',
  overtime_hours: 0,
  overtime_multiplier: 1.15,
  regular_salary: 0,
  overtime_salary: 0,
  total_salary: 0,
  status: 'Present',
  remarks: '',
}

const calculateHours = (timeIn, timeOut, isRegular = false) => {
  if (!timeIn || !timeOut) return 0
  const start = new Date(`2000-01-01T${timeIn}`)
  const end = new Date(`2000-01-01T${timeOut}`)
  let hours = (end - start) / (1000 * 60 * 60)
  if (hours < 0) hours += 24
  if (isRegular && hours > 1) {
    const noon = new Date(`2000-01-01T12:00`)
    const onepm = new Date(`2000-01-01T13:00`)
    if (start < onepm && end > noon) hours -= 1
  }
  return parseFloat(hours.toFixed(2))
}

const calculateSalaries = (data, employee) => {
  if (!employee || !employee.daily_salary) return data
  const hourlyRate = employee.daily_salary / 8
  const regularSalary = hourlyRate * (data.regular_hours || 0)
  const overtimeSalary = hourlyRate * (data.overtime_multiplier || 1.15) * (data.overtime_hours || 0)
  return {
    ...data,
    regular_salary: parseFloat(regularSalary.toFixed(2)),
    overtime_salary: parseFloat(overtimeSalary.toFixed(2)),
    total_salary: parseFloat((regularSalary + overtimeSalary).toFixed(2)),
  }
}

export default function Attendance() {
  const { canWrite } = usePermissions()
  const { hasRole } = useAuth()
  const hideSalary = hasRole('Project Coordinator') || hasRole('Project Manager')
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingAttendance, setEditingAttendance] = useState(null)
  const [deleteRecord, setDeleteRecord] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('day')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [formData, setFormData] = useState(emptyForm)
  const [selectedEmployees, setSelectedEmployees] = useState([])
  const [empSearch, setEmpSearch] = useState('')
  const [splitRecord, setSplitRecord] = useState(null)
  const [splitFormData, setSplitFormData] = useState(emptyForm)

  const { data: attendance = [], isLoading } = useQuery({ queryKey: ['attendance'], queryFn: getAttendance })
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })

  const createMutation = useMutation({
    mutationFn: createAttendance,
    onError: () => toast.error('Failed to log attendance'),
  })

  const updateMutation = useMutation({
    mutationFn: updateAttendance,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); closeForm(); toast.success('Attendance updated') },
    onError: () => toast.error('Failed to update attendance'),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteAttendance,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); setDeleteRecord(null); toast.success('Record deleted') },
    onError: () => toast.error('Failed to delete record'),
  })

  const closeForm = () => { setFormOpen(false); setEditingAttendance(null); setFormData(emptyForm); setSelectedEmployees([]); setEmpSearch('') }

  const handleEmployeeChange = (e) => {
    const emp = employees.find(x => x.id === parseInt(e.target.value))
    setFormData(prev => calculateSalaries({
      ...prev,
      employee_id: emp?.id || '',
      employee_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
    }, emp))
  }

  const handleProjectChange = (e) => {
    const proj = projects.find(x => x.id === parseInt(e.target.value))
    setFormData(prev => ({ ...prev, project_id: proj?.id || '', project_name: proj?.project_name || '' }))
  }

  const updateRegularHours = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'regular_time_in' || field === 'regular_time_out')
        updated.regular_hours = calculateHours(updated.regular_time_in, updated.regular_time_out, true)
      return calculateSalaries(updated, employees.find(e => e.id === prev.employee_id))
    })
  }

  const updateOvertimeHours = (field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'overtime_time_in' || field === 'overtime_time_out')
        updated.overtime_hours = calculateHours(updated.overtime_time_in, updated.overtime_time_out)
      return calculateSalaries(updated, employees.find(e => e.id === prev.employee_id))
    })
  }

  const handleEdit = (att) => {
    setEditingAttendance(att)
    setFormData({
      employee_id: att.employee_id || '',
      employee_name: att.employee_name || '',
      is_office_based: att.is_office_based || false,
      project_id: att.project_id || '',
      project_name: att.project_name || '',
      date: att.date || format(new Date(), 'yyyy-MM-dd'),
      regular_time_in: att.regular_time_in || '08:00',
      regular_time_out: att.regular_time_out || '17:00',
      regular_hours: att.regular_hours || 0,
      overtime_time_in: att.overtime_time_in || '',
      overtime_time_out: att.overtime_time_out || '',
      overtime_hours: att.overtime_hours || 0,
      overtime_multiplier: att.overtime_multiplier || 1.15,
      regular_salary: att.regular_salary || 0,
      overtime_salary: att.overtime_salary || 0,
      total_salary: att.total_salary || 0,
      status: att.status || 'Present',
      remarks: att.remarks || '',
    })
    setFormOpen(true)
  }

  const toggleEmployee = (empId) =>
    setSelectedEmployees(prev =>
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    )

  const handleSave = async () => {
    if (editingAttendance) {
      const payload = {
        ...formData,
        employee_id: parseInt(formData.employee_id),
        project_id: formData.project_id ? parseInt(formData.project_id) : null,
      }
      updateMutation.mutate({ id: editingAttendance.id, data: payload })
    } else {
      if (selectedEmployees.length === 0) { toast.error('Select at least one employee'); return }
      try {
        await Promise.all(
          selectedEmployees.map(empId => {
            const emp = employees.find(e => e.id === empId)
            const base = {
              ...formData,
              employee_id: empId,
              employee_name: emp ? `${emp.first_name} ${emp.last_name}` : '',
              project_id: formData.project_id ? parseInt(formData.project_id) : null,
            }
            return createMutation.mutateAsync(calculateSalaries(base, emp))
          })
        )
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
        closeForm()
        toast.success(`Attendance logged for ${selectedEmployees.length} employee(s)`)
      } catch {
        toast.error('Failed to log attendance')
      }
    }
  }

  const openSplit = (att, currentTimeOut) => {
    setSplitRecord(att)
    setSplitFormData({
      ...emptyForm,
      employee_id: att.employee_id,
      employee_name: att.employee_name,
      date: att.date,
      is_office_based: false,
      regular_time_in: currentTimeOut || att.regular_time_out || '',
      regular_time_out: '',
    })
  }

  const updateSplitField = (field, value, isRegular = false) => {
    setSplitFormData(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'regular_time_in' || field === 'regular_time_out')
        updated.regular_hours = calculateHours(updated.regular_time_in, updated.regular_time_out, true)
      if (field === 'overtime_time_in' || field === 'overtime_time_out')
        updated.overtime_hours = calculateHours(updated.overtime_time_in, updated.overtime_time_out)
      return calculateSalaries(updated, employees.find(e => e.id === prev.employee_id))
    })
  }

  const handleSplitSave = () => {
    const emp = employees.find(e => e.id === splitRecord.employee_id)
    const payload = calculateSalaries({
      ...splitFormData,
      employee_id: parseInt(splitFormData.employee_id),
      project_id: splitFormData.project_id ? parseInt(splitFormData.project_id) : null,
    }, emp)
    createMutation.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['attendance'] })
        setSplitRecord(null)
        toast.success('Split assignment logged')
      },
      onError: () => toast.error('Failed to log split assignment'),
    })
  }

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  const getDateRange = () => {
    switch (viewMode) {
      case 'week': return { start: startOfWeek(selectedDate, { weekStartsOn: 1 }), end: endOfWeek(selectedDate, { weekStartsOn: 1 }) }
      case 'month': return { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) }
      case 'year': return { start: startOfYear(selectedDate), end: endOfYear(selectedDate) }
      default: return { start: selectedDate, end: selectedDate }
    }
  }

  const navigateDate = (dir) => {
    setSelectedDate(prev => {
      if (viewMode === 'week') return addWeeks(prev, dir)
      if (viewMode === 'month') return addMonths(prev, dir)
      if (viewMode === 'year') return addYears(prev, dir)
      return addDays(prev, dir)
    })
  }

  const filtered = attendance.filter(att => {
    let matchesDate
    if (viewMode === 'day') {
      matchesDate = att.date === format(selectedDate, 'yyyy-MM-dd')
    } else {
      const { start, end } = getDateRange()
      const d = new Date(att.date + 'T00:00:00')
      matchesDate = d >= start && d <= end
    }
    const matchesEmp = employeeFilter === 'all' || att.employee_id === parseInt(employeeFilter)
    const matchesProj = projectFilter === 'all' || att.project_id === parseInt(projectFilter)
    return matchesDate && matchesEmp && matchesProj
  })

  const { sortKey, sortDir, toggle, sorted } = useSortable(filtered, 'date', 'desc')

  const loggedOnDate = new Set(
    attendance.filter(a => a.date === formData.date).map(a => a.employee_id)
  )

  const summaryRegularHours = filtered.reduce((s, a) => s + (parseFloat(a.regular_hours) || 0), 0)
  const summaryOTHours = filtered.reduce((s, a) => s + (parseFloat(a.overtime_hours) || 0), 0)
  const summaryTotalSalary = filtered.reduce((s, a) => s + (parseFloat(a.total_salary) || 0), 0)
  const summaryHeadcount = new Set(filtered.map(a => a.employee_id)).size
  const summaryDaysPresent = parseFloat((summaryRegularHours / 8).toFixed(1))

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-500 mt-1">Track employee attendance by project</p>
          </div>
          {canWrite('attendance') && (
            <button
              onClick={() => { setEditingAttendance(null); setFormData({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') }); setFormOpen(true) }}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <Plus size={16} /> Log Attendance
            </button>
          )}
        </div>

        {/* Date Navigation & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button onClick={() => navigateDate(-1)} className="p-2 border border-gray-300 rounded-md hover:bg-gray-50">
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-md min-w-[220px] justify-center">
              <Calendar size={15} className="text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                {viewMode === 'day' && format(selectedDate, 'EEEE, MMM d, yyyy')}
                {viewMode === 'week' && `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d')} – ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
                {viewMode === 'month' && format(selectedDate, 'MMMM yyyy')}
                {viewMode === 'year' && format(selectedDate, 'yyyy')}
              </span>
            </div>
            <button onClick={() => navigateDate(1)} className="p-2 border border-gray-300 rounded-md hover:bg-gray-50">
              <ChevronRight size={16} />
            </button>
            <button onClick={() => setSelectedDate(new Date())} className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
              Today
            </button>
          </div>

          <div className="flex gap-2 ml-auto">
            <select value={viewMode} onChange={e => setViewMode(e.target.value)}
              className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
            <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)}
              className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
              ))}
            </select>
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
              className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="all">All Projects</option>
              {projects.map(proj => (
                <option key={proj.id} value={proj.id}>{proj.project_name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        <div className={`grid grid-cols-2 gap-4 mb-6 ${viewMode !== 'day' && employeeFilter !== 'all' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Employees</p>
                <p className="text-2xl font-bold text-gray-900">{summaryHeadcount}</p>
              </div>
              <div className="bg-violet-500 p-2 rounded-lg"><Users size={18} className="text-white" /></div>
            </div>
          </div>
          {viewMode !== 'day' && employeeFilter !== 'all' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Days Present</p>
                  <p className="text-2xl font-bold text-gray-900">{summaryDaysPresent}d</p>
                  <p className="text-xs text-gray-400 mt-0.5">Based on regular hrs</p>
                </div>
                <div className="bg-teal-500 p-2 rounded-lg"><CalendarCheck size={18} className="text-white" /></div>
              </div>
            </div>
          )}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Regular Hours</p>
                <p className="text-2xl font-bold text-gray-900">{summaryRegularHours.toLocaleString()}h</p>
              </div>
              <div className="bg-blue-500 p-2 rounded-lg"><Clock size={18} className="text-white" /></div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Overtime Hours</p>
                <p className="text-2xl font-bold text-gray-900">{summaryOTHours.toLocaleString()}h</p>
              </div>
              <div className="bg-purple-500 p-2 rounded-lg"><Clock size={18} className="text-white" /></div>
            </div>
          </div>
          {!hideSalary && (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Labor Cost</p>
                <p className="text-2xl font-bold text-emerald-600">₱{summaryTotalSalary.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-500 p-2 rounded-lg"><DollarSign size={18} className="text-white" /></div>
            </div>
          </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortableHeader label="Date" field="date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Employee" field="employee_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Project" field="project_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Regular Hours" field="regular_hours" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="OT Hours" field="overtime_hours" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                {!hideSalary && <SortableHeader label="Salary" field="total_salary" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" align="right" />}
                <SortableHeader label="Status" field="status" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={hideSalary ? 7 : 8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={hideSalary ? 7 : 8} className="text-center py-8 text-gray-400">No attendance records for this period</td></tr>
              ) : sorted.map(att => (
                <tr key={att.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">
                    {att.date ? format(new Date(att.date + 'T00:00:00'), 'MMM d') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{att.employee_name}</p>
                    {att.is_office_based && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">Office</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {att.is_office_based ? <span className="text-gray-400 italic">Office Expense</span> : att.project_name || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{att.regular_hours || 0}h</p>
                    {att.regular_time_in && att.regular_time_out && (
                      <p className="text-xs text-gray-400">{att.regular_time_in} - {att.regular_time_out}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {att.overtime_hours > 0 ? (
                      <div>
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded text-xs font-medium">{att.overtime_hours}h</span>
                        {att.overtime_time_in && att.overtime_time_out && (
                          <p className="text-xs text-gray-400 mt-0.5">{att.overtime_time_in} - {att.overtime_time_out}</p>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  {!hideSalary && (
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-emerald-600">₱{(parseFloat(att.total_salary) || 0).toLocaleString()}</p>
                    {att.regular_salary > 0 && att.overtime_salary > 0 && (
                      <p className="text-xs text-gray-400">Reg: ₱{parseFloat(att.regular_salary).toLocaleString()} + OT: ₱{parseFloat(att.overtime_salary).toLocaleString()}</p>
                    )}
                  </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[att.status] || STATUS_COLORS.Present}`}>
                      {att.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite('attendance') && (
                        <button onClick={() => handleEdit(att)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canWrite('attendance') && (
                        <button onClick={() => setDeleteRecord(att)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Form Dialog */}
        {formOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingAttendance ? 'Edit Attendance' : 'Log Attendance'}
                </h2>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-5">

                {/* Office based */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <input type="checkbox" id="office_based" checked={formData.is_office_based}
                    onChange={e => setFormData(prev => ({
                      ...prev, is_office_based: e.target.checked,
                      project_id: e.target.checked ? '' : prev.project_id,
                      project_name: e.target.checked ? '' : prev.project_name,
                    }))}
                    className="w-4 h-4 rounded" />
                  <label htmlFor="office_based" className="flex items-center gap-2 text-sm font-medium text-blue-800 cursor-pointer">
                    <Building2 size={15} /> Office-based assignment (salary charged as office expense)
                  </label>
                </div>

                {editingAttendance ? (
                  /* ── EDIT MODE: single employee, project editable ── */
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Employee</label>
                      <div className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700">
                        {formData.employee_name}
                      </div>
                    </div>
                    {!formData.is_office_based && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Project *</label>
                        <select value={formData.project_id} onChange={handleProjectChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                          <option value="">Select project...</option>
                          {projects.map(proj => (
                            <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── CREATE MODE: project first, then date, then multi-employee ── */
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      {!formData.is_office_based && (
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Project *</label>
                          <select value={formData.project_id} onChange={handleProjectChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                            <option value="">Select project...</option>
                            {projects.map(proj => (
                              <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className={formData.is_office_based ? 'col-span-2' : ''}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                        <input type="date" value={formData.date}
                          onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-medium text-gray-700">
                          Employees * <span className="text-gray-400 font-normal">({selectedEmployees.length} selected)</span>
                        </label>
                        {selectedEmployees.length > 0 && (
                          <button type="button" onClick={() => setSelectedEmployees([])}
                            className="text-xs text-gray-400 hover:text-gray-600">Clear all</button>
                        )}
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="relative border-b border-gray-200">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                          <input
                            value={empSearch}
                            onChange={e => setEmpSearch(e.target.value)}
                            placeholder="Search employees..."
                            className="w-full pl-8 pr-3 py-2 text-sm focus:outline-none"
                          />
                        </div>
                        <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                          {employees
                            .filter(emp => `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(empSearch.toLowerCase()))
                            .map(emp => {
                              const alreadyLogged = loggedOnDate.has(emp.id)
                              const isSelected = selectedEmployees.includes(emp.id)
                              return (
                                <label key={emp.id}
                                  className={`flex items-center gap-3 px-4 py-2.5 ${alreadyLogged ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-pointer hover:bg-gray-50'}`}>
                                  <input type="checkbox"
                                    checked={isSelected}
                                    disabled={alreadyLogged}
                                    onChange={() => toggleEmployee(emp.id)}
                                    className="w-4 h-4 rounded accent-gray-900" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                                    {emp.position && <p className="text-xs text-gray-400">{emp.position}</p>}
                                  </div>
                                  {alreadyLogged && (
                                    <span className="text-xs text-amber-600 font-medium">Already logged</span>
                                  )}
                                </label>
                              )
                            })}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Date (edit mode only — create mode has it above) */}
                {editingAttendance && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                    <input type="date" value={formData.date}
                      onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  </div>
                )}

                {/* Regular Hours */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Regular Hours</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time In</label>
                      <input type="time" value={formData.regular_time_in}
                        onChange={e => updateRegularHours('regular_time_in', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time Out</label>
                      <input type="time" value={formData.regular_time_out}
                        onChange={e => updateRegularHours('regular_time_out', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                      <input type="number" value={formData.regular_hours} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                    </div>
                  </div>
                  {!hideSalary && editingAttendance && formData.regular_salary > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      Regular Salary: <span className="font-semibold text-emerald-600">₱{parseFloat(formData.regular_salary).toLocaleString()}</span>
                    </p>
                  )}
                  {!editingAttendance && (
                    <p className="mt-2 text-xs text-gray-400">Salary calculated per employee's rate on save</p>
                  )}
                </div>

                {/* Overtime Hours */}
                <div className="border rounded-lg p-4 bg-purple-50">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Overtime Hours</p>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time In</label>
                      <input type="time" value={formData.overtime_time_in}
                        onChange={e => updateOvertimeHours('overtime_time_in', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time Out</label>
                      <input type="time" value={formData.overtime_time_out}
                        onChange={e => updateOvertimeHours('overtime_time_out', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                      <input type="number" value={formData.overtime_hours} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">OT Multiplier</label>
                      <input type="number" step="0.01" value={formData.overtime_multiplier}
                        onChange={e => setFormData(prev => {
                          const updated = { ...prev, overtime_multiplier: parseFloat(e.target.value) || 1.15 }
                          return calculateSalaries(updated, employees.find(x => x.id === prev.employee_id))
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                  </div>
                  {!hideSalary && editingAttendance && formData.overtime_salary > 0 && (
                    <p className="mt-3 text-sm text-purple-700">
                      Overtime Salary ({formData.overtime_multiplier}x): <span className="font-semibold">₱{parseFloat(formData.overtime_salary).toLocaleString()}</span>
                    </p>
                  )}
                </div>

                {/* Total (edit mode only) */}
                {!hideSalary && editingAttendance && formData.total_salary > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total Salary:</span>
                    <span className="text-2xl font-bold text-emerald-600">₱{parseFloat(formData.total_salary).toLocaleString()}</span>
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                    <option>Present</option>
                    <option>Absent</option>
                    <option>Half-day</option>
                    <option>Leave</option>
                  </select>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea value={formData.remarks} rows={2}
                    onChange={e => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              </div>

              <div className="flex justify-between gap-2 px-6 py-4 border-t">
                <div>
                  {editingAttendance && (
                    <button onClick={async () => {
                      const att = editingAttendance
                      const t = formData.regular_time_out
                      try {
                        await updateMutation.mutateAsync({
                          id: att.id,
                          data: {
                            ...formData,
                            employee_id: parseInt(formData.employee_id),
                            project_id: formData.project_id ? parseInt(formData.project_id) : null,
                          }
                        })
                        openSplit(att, t)
                      } catch { /* error handled by mutation */ }
                    }}
                      className="flex items-center gap-2 px-4 py-2 text-sm border border-teal-400 text-teal-700 rounded-md hover:bg-teal-50">
                      <Plus size={15} /> Add Split Assignment
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={closeForm} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                  <button onClick={handleSave}
                    disabled={
                      editingAttendance
                        ? (!formData.is_office_based && !formData.project_id) || !formData.date
                        : selectedEmployees.length === 0 || (!formData.is_office_based && !formData.project_id) || !formData.date
                    }
                    className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                    {editingAttendance ? 'Update' : `Log Attendance${selectedEmployees.length > 1 ? ` (${selectedEmployees.length})` : ''}`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Split Assignment Dialog */}
        {splitRecord && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Add Split Assignment</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {splitRecord.employee_name} · {splitRecord.date} · continues from {splitFormData.regular_time_in || splitRecord.regular_time_out}
                  </p>
                </div>
                <button onClick={() => setSplitRecord(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-5">

                {/* Employee + Date locked */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Employee</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700">
                      {splitRecord.employee_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                    <div className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-700">
                      {splitRecord.date}
                    </div>
                  </div>
                </div>

                {/* Office-based toggle */}
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <input type="checkbox" id="split_office_based" checked={splitFormData.is_office_based}
                    onChange={e => setSplitFormData(prev => ({
                      ...prev, is_office_based: e.target.checked,
                      project_id: e.target.checked ? '' : prev.project_id,
                      project_name: e.target.checked ? '' : prev.project_name,
                    }))}
                    className="w-4 h-4 rounded" />
                  <label htmlFor="split_office_based" className="flex items-center gap-2 text-sm font-medium text-blue-800 cursor-pointer">
                    <Building2 size={15} /> Office-based assignment
                  </label>
                </div>

                {/* Project selector (hidden when office-based) */}
                {!splitFormData.is_office_based && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Project *</label>
                    <select value={splitFormData.project_id}
                      onChange={e => {
                        const proj = projects.find(x => x.id === parseInt(e.target.value))
                        setSplitFormData(prev => ({ ...prev, project_id: proj?.id || '', project_name: proj?.project_name || '' }))
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                      <option value="">Select project...</option>
                      {projects.map(proj => (
                        <option key={proj.id} value={proj.id}>{proj.project_name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Regular Hours */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Regular Hours</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time In</label>
                      <input type="time" value={splitFormData.regular_time_in}
                        onChange={e => updateSplitField('regular_time_in', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time Out</label>
                      <input type="time" value={splitFormData.regular_time_out}
                        onChange={e => updateSplitField('regular_time_out', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                      <input type="number" value={splitFormData.regular_hours} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                    </div>
                  </div>
                  {splitFormData.regular_salary > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      Regular Salary: <span className="font-semibold text-emerald-600">₱{parseFloat(splitFormData.regular_salary).toLocaleString()}</span>
                    </p>
                  )}
                </div>

                {/* Overtime Hours */}
                <div className="border rounded-lg p-4 bg-purple-50">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Overtime Hours</p>
                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time In</label>
                      <input type="time" value={splitFormData.overtime_time_in}
                        onChange={e => updateSplitField('overtime_time_in', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Time Out</label>
                      <input type="time" value={splitFormData.overtime_time_out}
                        onChange={e => updateSplitField('overtime_time_out', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Hours</label>
                      <input type="number" value={splitFormData.overtime_hours} readOnly
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">OT Multiplier</label>
                      <input type="number" step="0.01" value={splitFormData.overtime_multiplier}
                        onChange={e => setSplitFormData(prev => {
                          const updated = { ...prev, overtime_multiplier: parseFloat(e.target.value) || 1.15 }
                          return calculateSalaries(updated, employees.find(x => x.id === prev.employee_id))
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                  </div>
                  {splitFormData.overtime_salary > 0 && (
                    <p className="mt-3 text-sm text-purple-700">
                      Overtime Salary ({splitFormData.overtime_multiplier}x): <span className="font-semibold">₱{parseFloat(splitFormData.overtime_salary).toLocaleString()}</span>
                    </p>
                  )}
                </div>

                {splitFormData.total_salary > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex justify-between items-center">
                    <span className="font-medium text-gray-900">Total Salary:</span>
                    <span className="text-2xl font-bold text-emerald-600">₱{parseFloat(splitFormData.total_salary).toLocaleString()}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                  <textarea value={splitFormData.remarks} rows={2}
                    onChange={e => setSplitFormData(prev => ({ ...prev, remarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t">
                <button onClick={() => setSplitRecord(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleSplitSave}
                  disabled={(!splitFormData.is_office_based && !splitFormData.project_id) || !splitFormData.regular_time_in || !splitFormData.regular_time_out}
                  className="px-4 py-2 text-sm bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-50">
                  Log Split Assignment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteRecord && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Attendance Record</h3>
              <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this record? This action cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteRecord(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={() => deleteMutation.mutate(deleteRecord.id)}
                  className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}