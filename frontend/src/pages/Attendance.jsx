import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import {
  getAttendance, getEmployees, getProjects,
  createAttendance, updateAttendance, deleteAttendance
} from '../api/attendance'
import { Plus, ChevronLeft, ChevronRight, Calendar, Building2, Pencil, Trash2, X } from 'lucide-react'

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
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingAttendance, setEditingAttendance] = useState(null)
  const [deleteRecord, setDeleteRecord] = useState(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState('day')
  const [employeeFilter, setEmployeeFilter] = useState('all')
  const [projectFilter, setProjectFilter] = useState('all')
  const [formData, setFormData] = useState(emptyForm)

  const { data: attendance = [], isLoading } = useQuery({ queryKey: ['attendance'], queryFn: getAttendance })
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })

  const createMutation = useMutation({
    mutationFn: createAttendance,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['attendance'] }); closeForm(); toast.success('Attendance logged') },
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

  const closeForm = () => { setFormOpen(false); setEditingAttendance(null); setFormData(emptyForm) }

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

  const handleSave = () => {
    const payload = {
      ...formData,
      employee_id: parseInt(formData.employee_id),
      project_id: formData.project_id ? parseInt(formData.project_id) : null,
    }
    if (editingAttendance) {
      updateMutation.mutate({ id: editingAttendance.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }

  const navigateDate = (dir) => setSelectedDate(prev => addDays(prev, dir * (viewMode === 'day' ? 1 : 7)))

  const filtered = attendance.filter(att => {
    const matchesDate = viewMode === 'day'
      ? att.date === format(selectedDate, 'yyyy-MM-dd')
      : getWeekDays().some(d => format(d, 'yyyy-MM-dd') === att.date)
    const matchesEmp = employeeFilter === 'all' || att.employee_id === parseInt(employeeFilter)
    const matchesProj = projectFilter === 'all' || att.project_id === parseInt(projectFilter)
    return matchesDate && matchesEmp && matchesProj
  })

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
            <p className="text-sm text-gray-500 mt-1">Track employee attendance by project</p>
          </div>
          <button
            onClick={() => { setEditingAttendance(null); setFormData({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') }); setFormOpen(true) }}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} /> Log Attendance
          </button>
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
                {viewMode === 'day'
                  ? format(selectedDate, 'EEEE, MMM d, yyyy')
                  : `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                }
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

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Employee', 'Project', 'Regular Hours', 'OT Hours', 'Salary', 'Status', 'Actions'].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${h === 'Salary' || h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">No attendance records for this period</td></tr>
              ) : filtered.map(att => (
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
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-emerald-600">₱{(parseFloat(att.total_salary) || 0).toLocaleString()}</p>
                    {att.regular_salary > 0 && att.overtime_salary > 0 && (
                      <p className="text-xs text-gray-400">Reg: ₱{parseFloat(att.regular_salary).toLocaleString()} + OT: ₱{parseFloat(att.overtime_salary).toLocaleString()}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[att.status] || STATUS_COLORS.Present}`}>
                      {att.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => handleEdit(att)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteRecord(att)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
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

                {/* Employee & Project */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Employee *</label>
                    <select value={formData.employee_id} onChange={handleEmployeeChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                      <option value="">Select employee...</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                      ))}
                    </select>
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

                {/* Date */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={formData.date}
                    onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>

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
                  {formData.regular_salary > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      Regular Salary: <span className="font-semibold text-emerald-600">₱{parseFloat(formData.regular_salary).toLocaleString()}</span>
                    </p>
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
                  {formData.overtime_salary > 0 && (
                    <p className="mt-3 text-sm text-purple-700">
                      Overtime Salary ({formData.overtime_multiplier}x): <span className="font-semibold">₱{parseFloat(formData.overtime_salary).toLocaleString()}</span>
                    </p>
                  )}
                </div>

                {/* Total */}
                {formData.total_salary > 0 && (
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

              <div className="flex justify-end gap-2 px-6 py-4 border-t">
                <button onClick={closeForm} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave}
                  disabled={!formData.employee_id || (!formData.is_office_based && !formData.project_id) || !formData.date}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  {editingAttendance ? 'Update' : 'Log'} Attendance
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