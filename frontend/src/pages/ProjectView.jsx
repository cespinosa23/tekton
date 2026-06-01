import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import Layout from '../components/Layout'
import { getProjects, getTransactions, getAttendance, updateProject } from '../api/projects'
import {
  ArrowLeft, MapPin, User, Calendar,
  Banknote, Receipt, Package, Users, CheckCircle, Clock, XCircle, X,
  Building2, Tag, FileText, Hash, TrendingUp, TrendingDown
} from 'lucide-react'

const SCOPES = [
  { key: 'wiring_permit', label: 'Wiring Permit' },
  { key: 'electrical_plan', label: 'Electrical Plan Drafting' },
  { key: 'installation', label: 'Installation' },
  { key: 'cfei', label: 'CFEI' },
  { key: 'supply', label: 'Supply' },
  { key: 'meralco', label: 'Meralco Application' },
  { key: 'others', label: 'Others' },
]

const STATUS_COLORS = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-600',
  Completed: 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  Cancelled: 'bg-red-100 text-red-700',
}

const TX_TYPE_COLORS = {
  Payment: 'bg-green-100 text-green-700',
  'Materials Procurement': 'bg-blue-100 text-blue-700',
  'Outgoing Materials': 'bg-red-100 text-red-700',
  'Incoming Materials': 'bg-emerald-100 text-emerald-700',
  'General Expenditure': 'bg-amber-100 text-amber-700',
}

const fmt = (n) => `₱${Number(n || 0).toLocaleString()}`

export default function ProjectView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('transactions')
  const [scopeNotes, setScopeNotes] = useState({})
  const [selectedTx, setSelectedTx] = useState(null)

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: getTransactions })
  const { data: attendance = [] } = useQuery({ queryKey: ['attendance'], queryFn: getAttendance })

  const project = projects.find(p => p.id === parseInt(id))

  const updateMutation = useMutation({
    mutationFn: ({ data }) => updateProject({ id: parseInt(id), data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  if (!project) return (
    <Layout>
      <div className="p-8 text-center text-gray-400">Project not found.</div>
    </Layout>
  )

  const projectTx = transactions.filter(t => t.project_id === project.id)
  const projectAtt = attendance.filter(a => a.project_id === project.id)

  const totalPayments = projectTx.filter(t => t.transaction_type === 'Payment')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

  const laborCost = projectAtt.reduce((s, a) => s + (parseFloat(a.total_salary) || 0), 0)

  const procurementCost = projectTx.filter(t => t.transaction_type === 'Materials Procurement')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const outgoingCost = projectTx.filter(t => t.transaction_type === 'Outgoing Materials')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const incomingCost = projectTx.filter(t => t.transaction_type === 'Incoming Materials')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)
  const materialsCost = procurementCost + outgoingCost - incomingCost

  const othersCost = projectTx.filter(t => t.transaction_type === 'General Expenditure')
    .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

  const totalExpenses = materialsCost + othersCost + laborCost

  const handleScopeStatusChange = (scopeKey, newStatus) => {
    const updateData = { [`scope_${scopeKey}_status`]: newStatus }
    if (newStatus === 'complete' && !project[`scope_${scopeKey}_date`]) {
      updateData[`scope_${scopeKey}_date`] = new Date().toISOString().split('T')[0]
    }
    updateMutation.mutate({ data: updateData })
  }

  const handleScopeFieldUpdate = (scopeKey, field, value) => {
    updateMutation.mutate({ data: { [`scope_${scopeKey}_${field}`]: value } })
  }

  return (
    <Layout>
      <div className="p-8 max-w-5xl">
        {/* Back */}
        <button onClick={() => navigate('/projects')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6">
          <ArrowLeft size={16} /> Back to Projects
        </button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{project.project_name}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.Inactive}`}>
                {project.status}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1"><User size={13} />{project.owner_company_name}</div>
              <div className="flex items-center gap-1"><MapPin size={13} />{project.address}</div>
              {project.quotation_date && (
                <div className="flex items-center gap-1">
                  <Calendar size={13} />{format(new Date(project.quotation_date), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Contract Cost', value: fmt(project.contract_cost), color: 'bg-emerald-50', iconColor: 'text-emerald-600', icon: Banknote },
            { label: 'Total Payments', value: fmt(totalPayments), color: 'bg-green-50', iconColor: 'text-green-600', icon: Receipt },
            { label: 'Total Expenses', value: fmt(totalExpenses), color: 'bg-red-50', iconColor: 'text-red-600', icon: Package },
            { label: 'Encumbrance', value: fmt(project.encumbrance), color: 'bg-amber-50', iconColor: 'text-amber-600', icon: Banknote },
            { label: 'Labor Cost', value: fmt(laborCost), color: 'bg-purple-50', iconColor: 'text-purple-600', icon: Users },
          ].map(({ label, value, color, iconColor, icon: Icon }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-lg font-bold ${iconColor}`}>{value}</p>
                </div>
                <div className={`p-2 ${color} rounded-lg`}>
                  <Icon size={18} className={iconColor} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Scope Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Scope Status</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {SCOPES.map(scope => {
              const isIncluded = project[`scope_${scope.key}`]
              const currentStatus = project[`scope_${scope.key}_status`] || 'not_included'
              const completionDate = project[`scope_${scope.key}_date`]
              const notes = project[`scope_${scope.key}_notes`] || ''

              return (
                <div key={scope.key}
                  className={`p-4 rounded-lg border space-y-3 ${isIncluded ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isIncluded ? 'text-gray-900' : 'text-gray-400'}`}>
                      {scope.label}
                    </span>
                    <div className={`w-3 h-3 rounded-full ${!isIncluded || currentStatus === 'not_included' ? 'bg-gray-200' :
                        currentStatus === 'pending' ? 'bg-amber-400' : 'bg-emerald-500'
                      }`} />
                  </div>

                  {isIncluded && (
                    <>
                      <select value={currentStatus}
                        onChange={e => handleScopeStatusChange(scope.key, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-400">
                        <option value="pending">Pending</option>
                        <option value="complete">Complete</option>
                      </select>

                      {currentStatus === 'complete' && (
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Completion Date</label>
                          <input type="date" value={completionDate || ''}
                            onChange={e => handleScopeFieldUpdate(scope.key, 'date', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-400" />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Notes</label>
                        <textarea
                          defaultValue={notes} rows={2}
                          onBlur={e => handleScopeFieldUpdate(scope.key, 'notes', e.target.value)}
                          placeholder="Add notes..."
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
                      </div>
                    </>
                  )}

                  {scope.key === 'others' && project.scope_others_text && (
                    <p className="text-xs text-gray-400 italic">{project.scope_others_text}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[['transactions', 'Transactions'], ['payroll', 'Payroll / Attendance'], ['details', 'Details']].map(([val, label]) => (
            <button key={val} onClick={() => setActiveTab(val)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === val ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {/* Cost Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Materials Cost</p>
                <p className="text-2xl font-bold text-blue-700">{fmt(materialsCost)}</p>
                <div className="mt-2 space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between"><span>Procurement:</span><span>{fmt(procurementCost)}</span></div>
                  <div className="flex justify-between"><span>Outgoing:</span><span>{fmt(outgoingCost)}</span></div>
                  <div className="flex justify-between"><span>Incoming (return):</span><span>-{fmt(incomingCost)}</span></div>
                </div>
              </div>
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Other Transactions</p>
                <p className="text-2xl font-bold text-amber-700">{fmt(othersCost)}</p>
                <p className="text-xs text-gray-500 mt-2">General expenditures</p>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Labor Cost</p>
                <p className="text-2xl font-bold text-purple-700">{fmt(laborCost)}</p>
                <p className="text-xs text-gray-500 mt-2">From attendance records</p>
              </div>
              <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Total Project Expenses</p>
                <p className="text-3xl font-bold text-gray-900">{fmt(totalExpenses)}</p>
              </div>
            </div>

            {/* Transaction History */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Transaction History</h3>
              </div>
              {projectTx.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">No transactions recorded for this project.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['#', 'Date', 'Type', 'Description', 'Amount'].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${h === 'Amount' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projectTx.map(tx => (
                      <tr key={tx.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedTx(tx)}>
                        <td className="px-4 py-3 text-gray-400 text-xs font-mono">{tx.id}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {tx.transaction_date ? format(new Date(tx.transaction_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${TX_TYPE_COLORS[tx.transaction_type] || 'bg-gray-100 text-gray-600'}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {tx.transaction_type === 'General Expenditure' && tx.expenditure_category ? (
                            <div>
                              {tx.description && <p>{tx.description}</p>}
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                                {tx.expenditure_category}
                              </span>
                            </div>
                          ) : (
                            tx.description || '-'
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${tx.transaction_type === 'Payment' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.transaction_type === 'Payment' ? '+' : '-'}{fmt(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Payroll Tab */}
        {activeTab === 'payroll' && (
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Attendance Records</h3>
            </div>
            {projectAtt.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No attendance records for this project.</div>
            ) : (
              <>
                <div className="mx-4 my-3 p-4 bg-purple-50 border border-purple-200 rounded-lg flex justify-between items-center">
                  <span className="font-medium text-gray-900">Total Labor Cost:</span>
                  <span className="text-2xl font-bold text-purple-600">{fmt(laborCost)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Date', 'Employee', 'Regular Hours', 'OT Hours', 'Salary', 'Status'].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${h === 'Salary' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projectAtt.map(att => (
                      <tr key={att.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">
                          {att.date ? format(new Date(att.date + 'T00:00:00'), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{att.employee_name}</td>
                        <td className="px-4 py-3">
                          <p>{att.regular_hours || 0}h</p>
                          {att.regular_time_in && att.regular_time_out && (
                            <p className="text-xs text-gray-400">{att.regular_time_in} - {att.regular_time_out}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {parseFloat(att.overtime_hours) > 0 ? (
                            <>
                              <p>{att.overtime_hours}h</p>
                              {att.overtime_time_in && att.overtime_time_out && (
                                <p className="text-xs text-gray-400">{att.overtime_time_in} - {att.overtime_time_out}</p>
                              )}
                            </>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-emerald-600">{fmt(att.total_salary)}</p>
                          {parseFloat(att.regular_salary) > 0 && parseFloat(att.overtime_salary) > 0 && (
                            <p className="text-xs text-gray-400">Reg: {fmt(att.regular_salary)} + OT: {fmt(att.overtime_salary)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{att.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Project Details</h2>
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div className="space-y-4">
                {[
                  ['Referred By', project.referred_by],
                  ['LGU', project.lgu],
                  ['Meralco Branch', project.meralco_branch],
                  ['Project Manager', project.project_manager],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="font-medium text-gray-900">{value || '-'}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Other Notes</p>
                <p className="text-gray-700 whitespace-pre-wrap">{project.other_notes || 'No additional notes.'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTx(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${TX_TYPE_COLORS[selectedTx.transaction_type] || 'bg-gray-100 text-gray-600'}`}>
                  {selectedTx.transaction_type}
                </span>
                <span className="text-xs text-gray-400 font-mono">#{selectedTx.id}</span>
              </div>
              <button onClick={() => setSelectedTx(null)}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5 text-sm">

              {/* Amount + Date */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Amount</p>
                  <p className={`text-3xl font-bold ${selectedTx.transaction_type === 'Payment' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedTx.transaction_type === 'Payment' ? '+' : '-'}{fmt(selectedTx.amount)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Date</p>
                  <p className="font-medium text-gray-900">
                    {selectedTx.transaction_date
                      ? format(new Date(selectedTx.transaction_date + 'T00:00:00'), 'MMMM d, yyyy')
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Adjustment direction badge */}
              {selectedTx.transaction_type === 'Adjustment' && selectedTx.adjustment_direction && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                  ${selectedTx.adjustment_direction === 'add'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {selectedTx.adjustment_direction === 'add'
                    ? <><TrendingUp size={15} /> Stock Added</>
                    : <><TrendingDown size={15} /> Stock Deducted</>}
                </div>
              )}

              {/* Key Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {selectedTx.supplier && (
                  <div className="flex items-start gap-2">
                    <Building2 size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Supplier</p>
                      <p className="font-medium text-gray-900">{selectedTx.supplier}</p>
                    </div>
                  </div>
                )}
                {selectedTx.reference_number && (
                  <div className="flex items-start gap-2">
                    <Hash size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Reference No.</p>
                      <p className="font-medium text-gray-900">{selectedTx.reference_number}</p>
                    </div>
                  </div>
                )}
                {selectedTx.expenditure_category && (
                  <div className="flex items-start gap-2">
                    <Tag size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Category</p>
                      <p className="font-medium text-gray-900">{selectedTx.expenditure_category}</p>
                    </div>
                  </div>
                )}
                {selectedTx.is_office_expense !== undefined && (
                  <div className="flex items-start gap-2">
                    <Building2 size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">Charged To</p>
                      <p className="font-medium text-gray-900">
                        {selectedTx.is_office_expense ? 'Office / Operational' : project.project_name}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedTx.description && (
                <div className="flex items-start gap-2">
                  <FileText size={14} className="text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Description</p>
                    <p className="text-gray-700">{selectedTx.description}</p>
                  </div>
                </div>
              )}

              {/* Materials List */}
              {selectedTx.materials?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                    Materials ({selectedTx.materials.length} item{selectedTx.materials.length !== 1 ? 's' : ''})
                  </p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Material</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Qty</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Unit Cost</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedTx.materials.map((mat, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-gray-900">
                                {mat.material_name || `Material #${mat.material_id}`}
                              </p>
                              {mat.brand && (
                                <p className="text-gray-400 mt-0.5">{mat.brand}</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-600">
                              {mat.quantity} {mat.unit || ''}
                            </td>
                            <td className="px-3 py-2.5 text-right text-gray-600">
                              {fmt(mat.unit_cost)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                              {fmt(mat.total_cost ?? (mat.quantity * mat.unit_cost))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-gray-200">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right text-gray-500 font-medium">Total</td>
                          <td className="px-3 py-2 text-right font-bold text-gray-900">{fmt(selectedTx.amount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Remarks */}
              {selectedTx.remarks && (
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-400 mb-1">Remarks</p>
                  <p className="text-gray-700">{selectedTx.remarks}</p>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setSelectedTx(null)}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}