import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import {
  getProjects, createProject, updateProject, archiveProject,
  getTransactions, getAttendance, getSettings
} from '../api/projects'
import { getEmployees } from '../api/employees'
import {
  Plus, Search, Eye, Pencil, Trash2, Archive,
  MapPin, User, Calendar, X, Filter
} from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../context/AuthContext'
import { formatNumberDisplay, normalizeNumberInput, sanitizeNumberInput } from '../utils/numberInput'
import { scrollContentToTop } from '../utils/scroll'


const SCOPES = [
  { key: 'wiring_permit', label: 'Wiring Permit' },
  { key: 'electrical_plan', label: 'Electrical Plan' },
  { key: 'installation', label: 'Installation' },
  { key: 'cfei', label: 'CFEI' },
  { key: 'supply', label: 'Supply' },
  { key: 'meralco', label: 'Meralco' },
  { key: 'others', label: 'Others' },
]

const STATUS_COLORS = {
  Active: 'bg-emerald-100 text-emerald-700',
  Inactive: 'bg-slate-100 text-slate-600',
  Completed: 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700',
  Cancelled: 'bg-red-100 text-red-700',
}

const SCOPE_COLORS = {
  not_included: 'bg-gray-200',
  pending: 'bg-amber-400',
  complete: 'bg-emerald-500',
}

const getScopeStatus = (project, key) => {
  if (!project[`scope_${key}`]) return 'not_included'
  return project[`scope_${key}_status`] === 'complete' ? 'complete' : 'pending'
}

const fmt = (n) => `₱${Number(n || 0).toLocaleString()}`

const emptyForm = {
  owner_company_name: '', address: '', project_name: '',
  quotation_date: '', status: 'Active',
  scope_wiring_permit: false, scope_electrical_plan: false,
  scope_installation: false, scope_cfei: false,
  scope_supply: false, scope_meralco: false,
  scope_encumbrance: false,
  scope_others: false, scope_others_text: '',
  scope_wiring_permit_cost: '', scope_electrical_plan_cost: '',
  scope_installation_cost: '', scope_supply_cost: '',
  scope_meralco_cost: '', scope_others_cost: '',
  encumbrance: '',
  project_manager: '', referred_by: '',
  lgu: '', meralco_branch: '',
  contract_cost: 0, other_notes: '',
}

const FORM_SCOPES = [
  { key: 'wiring_permit', label: 'Wiring Permit / CFEI Processing', costField: 'scope_wiring_permit_cost', mirror: 'cfei' },
  { key: 'electrical_plan', label: 'Electrical Plan Drafting',    costField: 'scope_electrical_plan_cost' },
  { key: 'supply',          label: 'Supply of Materials',             costField: 'scope_supply_cost' },
  { key: 'installation',    label: 'Installation Works',       costField: 'scope_installation_cost' },
  { key: 'meralco',         label: 'Meralco Application',            costField: 'scope_meralco_cost' },
  { key: 'encumbrance',     label: 'Encumbrance',        costField: 'encumbrance' },
  { key: 'others',          label: 'Others',             costField: 'scope_others_cost', hasRemarks: true },
]

// --- ProjectCard ---
function ProjectCard({ project, onEdit, onDelete, onScopeClick }) {
  const navigate = useNavigate()
  const { canWrite } = usePermissions()

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start gap-6">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900 text-base">{project.project_name}</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ml-2 flex-shrink-0 ${STATUS_COLORS[project.status] || STATUS_COLORS.Inactive}`}>
              {project.status}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
            <User size={13} /><span className="truncate">{project.owner_company_name}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
            <MapPin size={13} /><span className="truncate">{project.address}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Contract: <span className="font-semibold text-gray-900">{fmt(project.contract_cost)}</span></span>
            {project.quotation_date && (
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Calendar size={12} />
                {format(new Date(project.quotation_date), 'MMM d, yyyy')}
              </div>
            )}
          </div>
        </div>

        {/* Scopes */}
        <div className="flex-shrink-0 flex items-center gap-3 self-center">
          {SCOPES.map(scope => (
            <div key={scope.key} onClick={(e) => { e.stopPropagation(); onScopeClick(project, scope.key) }}
              className="flex flex-col items-center gap-1 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded"
              title={scope.label}>
              <span className="text-[10px] text-gray-500 font-medium">{scope.label}</span>
              <div className={`w-3 h-3 rounded-full ${SCOPE_COLORS[getScopeStatus(project, scope.key)]}`} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-1.5 border-l border-gray-100 pl-4">
          <button onClick={() => navigate(`/projects/${project.id}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded transition-colors">
            <Eye size={13} /> View
          </button>
          {canWrite('projects') && (
            <button onClick={() => onEdit(project)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
              <Pencil size={13} /> Edit
            </button>
          )}
          {canWrite('projects') && (
            <button onClick={() => onDelete(project)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
              <Trash2 size={13} /> Archive
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- PaymentsView ---
function PaymentsView({ projects }) {
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: getTransactions })
  const { data: attendance = [] } = useQuery({ queryKey: ['attendance'], queryFn: getAttendance })

  if (projects.length === 0) return (
    <div className="text-center py-16 text-gray-400">No projects to display.</div>
  )

  return (
    <div className="space-y-4">
      {projects.map(project => {
        const projectTx = transactions.filter(t => t.project_id === project.id)
        const projectAtt = attendance.filter(a => a.project_id === project.id)

        const totalContract = parseFloat(project.contract_cost) || 0
        const encumbrance = parseFloat(project.encumbrance) || 0
        const contractCost = totalContract - encumbrance // pure scope cost, excluding encumbrance, for the chart segment below

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
        const totalPayments = projectTx
          .filter(t => t.transaction_type === 'Payment')
          .reduce((s, t) => s + (parseFloat(t.amount) || 0), 0)

        const maxVal = Math.max(totalContract, totalExpenses, totalPayments, 1)

        const bars = [
          {
            label: 'Contract', total: totalContract, segments: [
              { label: 'Contract Cost', value: contractCost, color: '#10b981' },
              { label: 'Encumbrance', value: encumbrance, color: '#6ee7b7' },
            ]
          },
          {
            label: 'Expenses', total: totalExpenses, segments: [
              { label: 'Labor', value: laborCost, color: '#8b5cf6' },
              { label: 'Materials', value: materialsCost, color: '#3b82f6' },
              { label: 'Others', value: othersCost, color: '#f59e0b' },
            ]
          },
          {
            label: 'Payments', total: totalPayments, segments: [
              { label: 'Payments Received', value: totalPayments, color: '#22c55e' },
            ]
          },
        ]

        return (
          <div key={project.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex gap-4">
              <div className="w-44 flex-shrink-0">
                <p className="font-semibold text-gray-900 text-sm">{project.project_name}</p>
                <p className="text-xs text-gray-500 truncate">{project.owner_company_name}</p>
                <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[project.status] || STATUS_COLORS.Inactive}`}>
                  {project.status}
                </span>
              </div>
              <div className="flex-1 space-y-3">
                {bars.map(bar => (
                  <div key={bar.label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-gray-600">{bar.label}</span>
                      <span className="text-xs font-semibold text-gray-800">{fmt(bar.total)}</span>
                    </div>
                    <div className="h-5 bg-gray-100 rounded-full overflow-hidden flex">
                      {bar.segments.map(seg => {
                        const width = (seg.value / maxVal) * 100
                        return width > 0 ? (
                          <div key={seg.label} title={`${seg.label}: ${fmt(seg.value)}`}
                            className="h-full transition-opacity hover:opacity-80"
                            style={{ width: `${width}%`, background: seg.color }} />
                        ) : null
                      })}
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-3 pt-1">
                  {[['#10b981', 'Contract Cost'], ['#6ee7b7', 'Encumbrance'], ['#8b5cf6', 'Labor'], ['#3b82f6', 'Materials'], ['#f59e0b', 'Others'], ['#22c55e', 'Payments']].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1 text-xs text-gray-500">
                      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// --- ProjectForm ---
function ProjectForm({ open, onClose, project, onSave, settings, projectManagers = [] }) {
  const [formData, setFormData] = useState(emptyForm)
  const [noReferral, setNoReferral] = useState(false)

  useEffect(() => {
    if (project) {
      setFormData({
        owner_company_name: project.owner_company_name || '',
        address: project.address || '',
        project_name: project.project_name || '',
        quotation_date: project.quotation_date || '',
        status: project.status || 'Active',
        scope_wiring_permit: project.scope_wiring_permit || false,
        scope_electrical_plan: project.scope_electrical_plan || false,
        scope_installation: project.scope_installation || false,
        scope_cfei: project.scope_cfei || false,
        scope_supply: project.scope_supply || false,
        scope_meralco: project.scope_meralco || false,
        scope_encumbrance: project.scope_encumbrance || false,
        scope_others: project.scope_others || false,
        scope_others_text: project.scope_others_text || '',
        scope_wiring_permit_cost: project.scope_wiring_permit_cost || '',
        scope_electrical_plan_cost: project.scope_electrical_plan_cost || '',
        scope_installation_cost: project.scope_installation_cost || '',
        scope_supply_cost: project.scope_supply_cost || '',
        scope_meralco_cost: project.scope_meralco_cost || '',
        scope_others_cost: project.scope_others_cost || '',
        encumbrance: project.encumbrance || '',
        project_manager: project.project_manager || '',
        referred_by: project.referred_by || '',
        lgu: project.lgu || '',
        meralco_branch: project.meralco_branch || '',
        contract_cost: project.contract_cost || 0,
        other_notes: project.other_notes || '',
      })
      setNoReferral(project.referred_by === 'N/A')
    } else {
      setFormData(emptyForm)
      setNoReferral(false)
    }
  }, [project])

  const getOptions = (category) => settings.filter(s => s.category === category && s.is_active)

  const toggleScope = (key, checked, mirror) => {
    const update = { [`scope_${key}`]: checked }
    if (mirror) update[`scope_${mirror}`] = checked
    setFormData(p => ({ ...p, ...update }))
  }

  const handleSelectAll = (checked) => {
    setFormData(p => ({
      ...p,
      scope_wiring_permit: checked, scope_cfei: checked,
      scope_electrical_plan: checked, scope_installation: checked,
      scope_supply: checked, scope_meralco: checked, scope_encumbrance: checked,
    }))
  }

  const allSelected = FORM_SCOPES
    .filter(s => !s.hasRemarks)
    .every(s => formData[`scope_${s.key}`])

  const costInput = (field, enabled, hasError) => (
    <input
      type="text"
      disabled={!enabled}
      value={enabled ? formatNumberDisplay(formData[field]) : ''}
      placeholder="Required"
      onChange={e => {
        const sanitized = sanitizeNumberInput(e.target.value)
        if (sanitized === null) return
        setFormData(p => ({ ...p, [field]: sanitized }))
      }}
      onBlur={() => {
        if (!enabled) return
        setFormData(p => ({ ...p, [field]: normalizeNumberInput(p[field]) }))
      }}
      className={`w-36 px-3 py-1.5 text-right border rounded-md text-sm focus:outline-none focus:ring-2 ${
        !enabled
          ? 'border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed focus:ring-gray-400'
          : hasError
          ? 'border-red-400 bg-red-50 text-gray-900 focus:ring-red-300'
          : 'border-gray-300 bg-white text-gray-900 focus:ring-gray-400'
      }`}
    />
  )

  const scopeCostValid = FORM_SCOPES.every(s =>
    !formData[`scope_${s.key}`] || formData[s.costField] !== ''
  )

  const scopeTotal = FORM_SCOPES.reduce((sum, s) => {
    if (!formData[`scope_${s.key}`]) return sum
    return sum + (parseFloat(formData[s.costField]) || 0)
  }, 0)

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{project?.id ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <div className="px-6 py-4 space-y-5">

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Owner / Company Name *</label>
              <input value={formData.owner_company_name} onChange={e => setFormData(p => ({ ...p, owner_company_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Address *</label>
              <input value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Project Designator / Name *</label>
              <input value={formData.project_name} onChange={e => setFormData(p => ({ ...p, project_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Quotation Date</label>
              <input type="date" value={formData.quotation_date} onChange={e => setFormData(p => ({ ...p, quotation_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option>Active</option><option>Inactive</option><option>Completed</option>
                <option>On Hold</option><option>Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Project Manager</label>
              <select value={formData.project_manager} onChange={e => setFormData(p => ({ ...p, project_manager: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Select...</option>
                {projectManagers.map(e => {
                  const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ')
                  return <option key={e.id} value={name}>{name}</option>
                })}
              </select>
            </div>
          </div>

          {/* Scope of Work */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Scope of Work</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded accent-gray-800" />
                <span className="text-xs text-gray-500 font-medium">Select All</span>
              </label>
            </div>
            {/* Column labels */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-white">
              <span className="text-xs text-gray-400">Scope</span>
              <span className="text-xs text-gray-400 w-36 text-right">Contract Cost (₱)</span>
            </div>
            {/* Scope rows */}
            <div className="divide-y divide-gray-100">
              {FORM_SCOPES.map(scope => {
                const checked = formData[`scope_${scope.key}`]
                const costError = checked && formData[scope.costField] === ''
                return (
                  <div key={scope.key} className={`px-4 py-2.5 transition-colors ${checked ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <div className="flex items-center justify-between gap-4">
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                        <input type="checkbox" checked={checked}
                          onChange={e => toggleScope(scope.key, e.target.checked, scope.mirror)}
                          className="w-4 h-4 rounded accent-gray-800 flex-shrink-0" />
                        <span className={`text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                          {scope.label}
                        </span>
                        {costError && <span className="text-xs text-red-500 ml-1">required</span>}
                      </label>
                      {costInput(scope.costField, checked, costError)}
                    </div>
                    {/* Others remarks */}
                    {scope.hasRemarks && checked && (
                      <div className="mt-2 ml-6">
                        <input
                          placeholder="Specify scope / remarks..."
                          value={formData.scope_others_text}
                          onChange={e => setFormData(p => ({ ...p, scope_others_text: e.target.value }))}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 text-gray-700"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {/* Total */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white">
              <span className="text-sm font-semibold">Total Contract Cost</span>
              <span className="text-base font-bold">
                ₱{scopeTotal.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Dropdowns */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Referred By *</label>
              <select value={noReferral ? 'N/A' : formData.referred_by}
                onChange={e => setFormData(p => ({ ...p, referred_by: e.target.value }))}
                disabled={noReferral}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50">
                <option value="">Select...</option>
                {getOptions('Referred By').map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
              </select>
              <div className="flex items-center gap-2 mt-1.5">
                <input type="checkbox" id="no_referral" checked={noReferral}
                  onChange={e => { setNoReferral(e.target.checked); setFormData(p => ({ ...p, referred_by: e.target.checked ? 'N/A' : '' })) }}
                  className="w-3.5 h-3.5 rounded" />
                <label htmlFor="no_referral" className="text-xs text-gray-500 cursor-pointer">N/A — No referral</label>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">LGU</label>
              <select value={formData.lgu} onChange={e => setFormData(p => ({ ...p, lgu: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Select...</option>
                {getOptions('LGU').map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Meralco Branch</label>
              <select value={formData.meralco_branch} onChange={e => setFormData(p => ({ ...p, meralco_branch: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                <option value="">Select...</option>
                {getOptions('Meralco Branch').map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Other Notes</label>
            <textarea value={formData.other_notes} rows={3}
              onChange={e => setFormData(p => ({ ...p, other_notes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(formData)}
            disabled={!formData.owner_company_name || !formData.address || !formData.project_name || !formData.referred_by || !scopeCostValid}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
            {project ? 'Update' : 'Create'} Project
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Main Projects Page ---
export default function Projects() {
  const { canWrite, canSeeNav } = usePermissions()
  const { isAdmin, hasRole, user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const [formOpen, setFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [deleteProject, setDeleteProject] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [pmFilter, setPmFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [activeTab, setActiveTab] = useState('progress')

  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: settings = [] } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery({ queryKey: ['employees'], queryFn: getEmployees })
  const projectManagers = useMemo(
    () => employees.filter(e => e.role === 'Project Manager' && !e.archived),
    [employees]
  )

  // Arriving from Quotations' "Create Project" action — pre-fill the New
  // Project form (still needs a manual Save, nothing is created here).
  // The Project Manager match is resolved here (not on the Quotations side)
  // because only this page has Employee records with middle names, which
  // the Project Manager <select> below needs to match exactly.
  // consumedPrefillRef guards against re-opening the modal if this effect
  // re-fires (e.g. from an unrelated re-render) before the state-clearing
  // navigate() below has actually landed — without it, closing the modal
  // right after arriving here could make it pop back open.
  const consumedPrefillRef = useRef(null)
  useEffect(() => {
    const state = location.state
    if (!state?.prefillProject || isLoadingEmployees) return
    if (consumedPrefillRef.current === state.prefillProject) return
    consumedPrefillRef.current = state.prefillProject
    const matchedPM = projectManagers.find(e =>
      e.first_name?.trim().toLowerCase() === state.prefillApproverFirstName?.trim().toLowerCase() &&
      e.last_name?.trim().toLowerCase() === state.prefillApproverLastName?.trim().toLowerCase()
    )
    const project_manager = matchedPM
      ? [matchedPM.first_name, matchedPM.middle_name, matchedPM.last_name].filter(Boolean).join(' ')
      : ''
    setEditingProject({ ...state.prefillProject, project_manager })
    setFormOpen(true)
    // Clear the router state so refreshing or navigating back doesn't re-trigger this.
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state, isLoadingEmployees, projectManagers])

  // For PM role: only show their own projects
  const myEmployee = user?.employee_id ? employees.find(e => e.id === user.employee_id) : null
  const myFullName = myEmployee
    ? [myEmployee.first_name, myEmployee.middle_name, myEmployee.last_name].filter(Boolean).join(' ')
    : null
  const isPM = hasRole('Project Manager') && !isAdmin()

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setFormOpen(false); toast.success('Project created') },
    onError: () => toast.error('Failed to create project'),
  })

  const updateMutation = useMutation({
    mutationFn: updateProject,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setFormOpen(false); setEditingProject(null); toast.success('Project updated') },
    onError: () => toast.error('Failed to update project'),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveProject,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setDeleteProject(null); toast.success('Project archived') },
    onError: () => toast.error('Failed to archive project'),
  })

  const handleSave = (data) => {
    // Contract cost includes every checked scope, encumbrance included — mirrors the live "Total Contract Cost" shown in the form.
    const contractCost = FORM_SCOPES
      .reduce((sum, s) => sum + (data[`scope_${s.key}`] ? parseFloat(data[s.costField]) || 0 : 0), 0)
    const encumbranceVal = data.scope_encumbrance ? parseFloat(data.encumbrance) || 0 : 0
    const COST_FIELDS = ['scope_wiring_permit_cost', 'scope_electrical_plan_cost', 'scope_installation_cost', 'scope_supply_cost', 'scope_meralco_cost', 'scope_others_cost']
    const sanitized = Object.fromEntries(
      COST_FIELDS.map(f => [f, data[f] === '' || data[f] == null ? 0 : parseFloat(data[f]) || 0])
    )
    const quotationDate = data.quotation_date === '' ? null : data.quotation_date
    const payload = { ...data, ...sanitized, contract_cost: contractCost, encumbrance: encumbranceVal, quotation_date: quotationDate }
    if (editingProject?.id) {
      updateMutation.mutate({ id: editingProject.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const handleScopeClick = (project, scopeKey) => {
    if (!project[`scope_${scopeKey}`]) return  // Not part of this project — ignore click
    const current = getScopeStatus(project, scopeKey)
    const next = current === 'complete' ? 'pending' : 'complete'
    const updateData = { [`scope_${scopeKey}_status`]: next }
    if (next === 'complete' && !project[`scope_${scopeKey}_date`]) {
      updateData[`scope_${scopeKey}_date`] = new Date().toISOString().split('T')[0]
    }
    updateMutation.mutate({ id: project.id, data: updateData })
  }

  const filtered = projects.filter(p => {
    const matchesSearch =
      p.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.owner_company_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.address?.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter
    const matchesPM = pmFilter === 'all' || p.project_manager === pmFilter
    return matchesSearch && matchesStatus && matchesPM
  })

  const sortedFiltered = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'newest':    return b.id - a.id
      case 'oldest':    return a.id - b.id
      case 'name_az':   return (a.project_name || '').localeCompare(b.project_name || '')
      case 'name_za':   return (b.project_name || '').localeCompare(a.project_name || '')
      case 'cost_high': return (parseFloat(b.contract_cost) || 0) - (parseFloat(a.contract_cost) || 0)
      case 'cost_low':  return (parseFloat(a.contract_cost) || 0) - (parseFloat(b.contract_cost) || 0)
      case 'date_new':  return new Date(b.quotation_date || 0) - new Date(a.quotation_date || 0)
      case 'date_old':  return new Date(a.quotation_date || 0) - new Date(b.quotation_date || 0)
      default:          return b.id - a.id
    }
  })

  if (!canSeeNav('/projects')) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">You don&apos;t have access to this page.</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-8">
        <div className="sticky top-0 z-20 bg-gray-50 flow-root">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all electrical service projects</p>
          </div>
          {canWrite('projects') && (
            <button onClick={() => { setEditingProject(null); setFormOpen(true) }}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors">
              <Plus size={16} /> New Project
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="all">All Status</option>
            <option>Active</option><option>Inactive</option><option>Completed</option>
            <option>On Hold</option><option>Cancelled</option>
          </select>
          {!isPM && (
            <select value={pmFilter} onChange={e => setPmFilter(e.target.value)}
              className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="all">All Project Managers</option>
              {projectManagers.map(e => {
                const name = [e.first_name, e.middle_name, e.last_name].filter(Boolean).join(' ')
                return <option key={e.id} value={name}>{name}</option>
              })}
            </select>
          )}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="newest">Newest Added</option>
            <option value="oldest">Oldest Added</option>
            <option value="date_new">Quote Date ↓</option>
            <option value="date_old">Quote Date ↑</option>
            <option value="name_az">Name A → Z</option>
            <option value="name_za">Name Z → A</option>
            <option value="cost_high">Cost: High → Low</option>
            <option value="cost_low">Cost: Low → High</option>
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[
            ['progress', 'Project Progress'],
            ...(isAdmin() || hasRole('Project Manager') ? [['payments', 'Payments View']] : []),
          ].map(([val, label]) => (
            <button key={val} onClick={() => { setActiveTab(val); scrollContentToTop() }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === val ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
        </div>

        {/* Progress Tab */}
        {activeTab === 'progress' && (() => {
          const visible = isPM && myFullName
            ? sortedFiltered.filter(p => p.project_manager === myFullName)
            : sortedFiltered
          return (isLoading || (isPM && isLoadingEmployees)) ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : visible.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Search size={40} className="mx-auto mb-3 opacity-50" />
              <p>{search || statusFilter !== 'all' ? 'Try adjusting your search or filters' : isPM ? 'No projects assigned to you' : 'Create your first project to get started'}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map(project => (
                <ProjectCard key={project.id} project={project}
                  onEdit={p => { setEditingProject(p); setFormOpen(true) }}
                  onDelete={setDeleteProject}
                  onScopeClick={handleScopeClick} />
              ))}
            </div>
          )
        })()}

        {/* Payments Tab */}
        {(isAdmin() || hasRole('Project Manager')) && activeTab === 'payments' && (() => {
          const visible = isPM && myFullName
            ? sortedFiltered.filter(p => p.project_manager === myFullName)
            : sortedFiltered
          return <PaymentsView projects={visible} />
        })()}

        {/* Form */}
        <ProjectForm open={formOpen} onClose={() => { setFormOpen(false); setEditingProject(null) }}
          project={editingProject} onSave={handleSave} settings={settings} projectManagers={projectManagers} />

        {/* Archive Confirmation */}
        {deleteProject && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive Project</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to archive <strong>"{deleteProject.project_name}"</strong>?
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteProject(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={() => archiveMutation.mutate(deleteProject.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">
                  <Archive size={15} /> Archive
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}