import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import Layout from '../components/Layout'
import { inviteEmployee as inviteEmployeeApi, getEmployees, createEmployee, updateEmployee, archiveEmployee, getEmployeeUsers } from '../api/employees'
import { Plus, Search, Eye, Pencil, Trash2, Archive, X, UserPlus } from 'lucide-react'


const statusColors = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-600',
  Resigned: 'bg-amber-100 text-amber-700',
  Terminated: 'bg-red-100 text-red-700',
}

const emptyForm = {
  first_name: '', middle_name: '', last_name: '',
  date_hired: '', daily_salary: 0, sss_number: '',
  philhealth_number: '', pagibig_number: '', tin_number: '',
  emergency_contact: '', emergency_phone: '',
  address: '', phone: '', email: '', status: 'Active',
  role: 'Engineer',
}

export default function Employees() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [viewEmployee, setViewEmployee] = useState(null)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [deleteEmployee, setDeleteEmployee] = useState(null)
  const [selectedInvite, setSelectedInvite] = useState(null)
  const [inviteRole, setInviteRole] = useState('Engineer')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formData, setFormData] = useState(emptyForm)

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
  })

  const { data: employeeRoles = {} } = useQuery({
    queryKey: ['employeeRoles'],
    queryFn: getEmployeeUsers,
  })

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setFormOpen(false)
      setFormData(emptyForm)
      toast.success('Employee added')

      if (variables.email && variables.role !== 'Others') {
        inviteMutation.mutate({ email: variables.email, roles: [variables.role || 'Engineer'] })
      }
    },
    onError: () => toast.error('Failed to add employee'),
  })

  const updateMutation = useMutation({
    mutationFn: updateEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setFormOpen(false)
      setEditingEmployee(null)
      setFormData(emptyForm)
      toast.success('Employee updated')
    },
    onError: () => toast.error('Failed to update employee'),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveEmployee,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setDeleteEmployee(null)
      toast.success('Employee archived')
    },
    onError: () => toast.error('Failed to archive employee'),
  })

  const inviteMutation = useMutation({
    mutationFn: inviteEmployeeApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['employeeRoles'] })
      setSelectedInvite(null)
      setInviteRole('Engineer')
      toast.success('Invite sent successfully')
    },
    onError: (err) => {
      const msg = err?.response?.data?.detail || 'Failed to send invite'
      toast.error(msg)
    },
  })

  const handleEdit = (emp) => {
    setEditingEmployee(emp)
    setFormData({
      first_name: emp.first_name || '',
      middle_name: emp.middle_name || '',
      last_name: emp.last_name || '',
      date_hired: emp.date_hired || '',
      daily_salary: emp.daily_salary || 0,
      sss_number: emp.sss_number || '',
      philhealth_number: emp.philhealth_number || '',
      pagibig_number: emp.pagibig_number || '',
      tin_number: emp.tin_number || '',
      emergency_contact: emp.emergency_contact || '',
      emergency_phone: emp.emergency_phone || '',
      address: emp.address || '',
      phone: emp.phone || '',
      email: emp.email || '',
      status: emp.status || 'Active',
      role: 'Engineer',
    })
    setFormOpen(true)
  }

  const handleSave = () => {
    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const set = (field) => (e) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }))

  const filtered = employees.filter((emp) => {
    const name = `${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`.toLowerCase()
    return (
      name.includes(search.toLowerCase()) &&
      (statusFilter === 'all' || emp.status === statusFilter)
    )
  })

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-sm text-gray-500 mt-1">Manage employee profiles and information</p>
          </div>
          <button
            onClick={() => { setEditingEmployee(null); setFormData(emptyForm); setFormOpen(true) }}
            className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            <Plus size={16} /> Add Employee
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="all">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Resigned">Resigned</option>
            <option value="Terminated">Terminated</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Date Hired</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Daily Salary</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No employees found</td></tr>
              ) : filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                        {emp.first_name?.charAt(0)}{emp.last_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.first_name} {emp.middle_name} {emp.last_name}</p>
                        {emp.email && <p className="text-xs text-gray-400">{emp.email}</p>}
                        {/* Role badges */}
                        {employeeRoles[emp.id] && employeeRoles[emp.id].length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {employeeRoles[emp.id].map(role => (
                              <span key={role} className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                role === 'Admin' ? 'bg-red-100 text-red-700' :
                                role === 'HR' ? 'bg-purple-100 text-purple-700' :
                                role === 'Accounting' ? 'bg-blue-100 text-blue-700' :
                                role === 'Engineer' ? 'bg-green-100 text-green-700' :
                                role === 'Liaison' ? 'bg-orange-100 text-orange-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {emp.date_hired ? format(new Date(emp.date_hired), 'MMM d, yyyy') : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">₱{(emp.daily_salary || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[emp.status]}`}>
                      {emp.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewEmployee(emp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Eye size={15} />
                      </button>
                      <button onClick={() => handleEdit(emp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                        <Pencil size={15} />
                      </button>
                      {emp.email && (
                        <button
                          onClick={() => { setSelectedInvite(emp); setInviteRole('Engineer') }}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500"
                          title="Invite / Assign Role"
                        >
                          <UserPlus size={15} />
                        </button>
                      )}
                      <button onClick={() => setDeleteEmployee(emp)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Dialog */}
        {formOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingEmployee ? 'Edit Employee' : 'Add Employee'}
                </h2>
                <button onClick={() => { setFormOpen(false); setEditingEmployee(null); setFormData(emptyForm) }}
                  className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-5">
                {/* Name */}
                <div className="grid grid-cols-3 gap-4">
                  {[['first_name', 'First Name *'], ['middle_name', 'Middle Name'], ['last_name', 'Last Name *']].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                      <input value={formData[field]} onChange={set(field)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                  ))}
                </div>
                {/* Employment */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date Hired</label>
                    <input type="date" value={formData.date_hired} onChange={set('date_hired')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Daily Salary (₱)</label>
                    <input type="number" value={formData.daily_salary}
                      onChange={(e) => setFormData(p => ({ ...p, daily_salary: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                    <select value={formData.status} onChange={set('status')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                      <option>Active</option>
                      <option>Inactive</option>
                      <option>Resigned</option>
                      <option>Terminated</option>
                    </select>
                  </div>
                </div>
                {/* Contact */}
                <div className="grid grid-cols-2 gap-4">
                  {[['phone', 'Phone'], ['address', 'Address']].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                      <input value={formData[field]} onChange={set(field)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                  ))}
                </div>
                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email Address {formData.role !== 'Others' && <span className="text-red-500">*</span>}
                  </label>
                  <input type="email" value={formData.email} onChange={set('email')}
                    placeholder="employee@example.com"
                    required={formData.role !== 'Others'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  {formData.role === 'Others' && (
                    <p className="text-xs text-gray-400 mt-1">Email optional for Others role — no system access will be created.</p>
                  )}
                </div>
                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">System Role</label>
                  <select value={formData.role} onChange={set('role')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                    <option value="Engineer">Engineer</option>
                    <option value="Accounting">Accounting</option>
                    <option value="HR">HR</option>
                    <option value="Liaison">Liaison</option>
                    <option value="Admin">Admin</option>
                    <option value="Others">Others</option>
                  </select>
                  {!formData.email && (
                    <p className="text-xs text-gray-400 mt-1">Add an email address to send a system invite.</p>
                  )}
                </div>
                {/* Gov IDs */}
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Government Benefits & Credentials</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[['sss_number', 'SSS Number'], ['philhealth_number', 'PhilHealth Number'], ['pagibig_number', 'Pag-IBIG Number'], ['tin_number', 'TIN Number']].map(([field, label]) => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                        <input value={formData[field]} onChange={set(field)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Emergency */}
                <div className="grid grid-cols-2 gap-4">
                  {[['emergency_contact', 'Emergency Contact Name'], ['emergency_phone', 'Emergency Contact Phone']].map(([field, label]) => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                      <input value={formData[field]} onChange={set(field)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t">
                <button onClick={() => { setFormOpen(false); setEditingEmployee(null); setFormData(emptyForm) }}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave}
                  disabled={
                    !formData.first_name || 
                    !formData.last_name || 
                    (formData.role !== 'Others' && !formData.email)
                  }
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  {editingEmployee ? 'Update' : 'Add'} Employee
                </button>
              </div>
            </div>
          </div>
        )}

        {/* View Dialog */}
        {viewEmployee && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Employee Details</h2>
                <button onClick={() => setViewEmployee(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold text-gray-600">
                    {viewEmployee.first_name?.charAt(0)}{viewEmployee.last_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{viewEmployee.first_name} {viewEmployee.middle_name} {viewEmployee.last_name}</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[viewEmployee.status]}`}>{viewEmployee.status}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    ['Date Hired', viewEmployee.date_hired ? format(new Date(viewEmployee.date_hired), 'MMM d, yyyy') : '-'],
                    ['Daily Salary', `₱${(viewEmployee.daily_salary || 0).toLocaleString()}`],
                    ['Phone', viewEmployee.phone || '-'],
                    ['Email', viewEmployee.email || '-'],
                    ['Address', viewEmployee.address || '-'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
                      <p className="font-medium text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Government IDs</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {[['SSS', viewEmployee.sss_number], ['PhilHealth', viewEmployee.philhealth_number], ['Pag-IBIG', viewEmployee.pagibig_number], ['TIN', viewEmployee.tin_number]].map(([label, value]) => (
                      <div key={label}>
                        <p className="text-gray-400 text-xs">{label}</p>
                        <p className="font-medium text-gray-900">{value || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Emergency Contact</p>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-400">Name: </span>{viewEmployee.emergency_contact || '-'}</p>
                    <p><span className="text-gray-400">Phone: </span>{viewEmployee.emergency_phone || '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Archive Confirmation */}
        {deleteEmployee && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive Employee</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to archive <strong>{deleteEmployee.first_name} {deleteEmployee.last_name}</strong>? You can restore them later from the Archive page.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteEmployee(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={() => archiveMutation.mutate(deleteEmployee.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">
                  <Archive size={15} /> Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Dialog */}
        {selectedInvite && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Invite Employee</h3>
              <p className="text-sm text-gray-500 mb-4">
                Send an invite to <strong>{selectedInvite.first_name} {selectedInvite.last_name}</strong> at <strong>{selectedInvite.email}</strong>
              </p>
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-700 mb-1">Assign Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                  <option value="Engineer">Engineer</option>
                  <option value="Accounting">Accounting</option>
                  <option value="HR">HR</option>
                  <option value="Liaison">Liaison</option>
                  <option value="Admin">Admin</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setSelectedInvite(null)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => inviteMutation.mutate({ email: selectedInvite.email, roles: [inviteRole] })}
                  disabled={inviteMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  <UserPlus size={15} />
                  {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}