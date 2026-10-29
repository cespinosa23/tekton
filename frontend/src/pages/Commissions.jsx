import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import { getCommissions, getCommissionRates, setCommissionTerms, setCommissionPayee, releaseCommission, reverseCommission } from '../api/commissions'
import { getEmployees } from '../api/employees'
import { useAuth } from '../context/AuthContext'
import { Search, Lock, ArrowUpRight, X, RotateCcw, Settings as SettingsIcon, Pencil } from 'lucide-react'
import { useSortable } from '../hooks/useSortable'
import { SortableHeader } from '../components/SortableHeader'
import { useElementHeight } from '../hooks/useElementHeight'
import { apiErrorMessage } from '../utils/apiError'
import { METHOD_LABELS, METHOD_FORMULAS, isValidPercent, isTypablePercent, fractionToPct, pctLabel } from '../lib/commission'

const TYPE_LABELS = { electrical_plan: 'Electrical Plan', project_management: 'Project Management' }
const TYPE_PILLS = {
  electrical_plan: 'bg-blue-50 text-blue-700',
  project_management: 'bg-violet-50 text-violet-700',
}

const peso = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fullName = (e) => [e.first_name, e.middle_name, e.last_name].filter(s => s && s.trim()).map(s => s.trim()).join(' ')
const normName = (s) => (s || '').split(/\s+/).filter(Boolean).join(' ').toLowerCase()
// Mirrors the backend's _is_project_manager: first + last name with any
// middle name/initial (or none) between — older projects store "Maria Santos"
// for the employee "Maria L. Santos".
const isProjectManager = (e, projectManager) => {
  const pm = normName(projectManager)
  const first = normName(e.first_name)
  const last = normName(e.last_name)
  if (!pm || !first || !last) return false
  if (pm === normName(fullName(e)) || pm === `${first} ${last}`) return true
  return pm.startsWith(`${first} `) && pm.endsWith(` ${last}`) && pm.length > first.length + last.length + 1
}
const rowKey = (r) => `${r.project_id}-${r.commission_type}`
const today = () => format(new Date(), 'yyyy-MM-dd')
const errMsg = (err, fallback) => apiErrorMessage(err, fallback)
// A row's rates are fractions (released rows keep the ones they were paid at).
const rowRatePct = (fraction) => `${fractionToPct(fraction)}%`
const totalExpenses = (r) => (Number(r.expenses_materials) || 0) + (Number(r.expenses_other) || 0) + (Number(r.expenses_labor) || 0)
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100

// Same formulas as the server (api/commissions.py), for the terms dialog's
// preview only — the saved/released amount always comes from the server.
function previewAmount(row, { method, rate, margin }) {
  const r = Number(rate) / 100
  let base
  if (row.commission_type === 'electrical_plan') base = Number(row.base) || 0
  else if (method === 'actual') base = (Number(row.project_cost) || 0) - totalExpenses(row)
  else base = (Number(row.project_cost) || 0) * (Number(margin) / 100)
  return round2(Math.max(base, 0) * r)
}

export default function Commissions() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('unreleased')
  const [releaseTarget, setReleaseTarget] = useState(null)
  const [releaseDate, setReleaseDate] = useState(today())
  const [reverseTarget, setReverseTarget] = useState(null)
  const [termsTarget, setTermsTarget] = useState(null)
  const [termsDraft, setTermsDraft] = useState({ method: 'assumed_margin', rate: '', margin: '' })

  const { data: defaults } = useQuery({ queryKey: ['commissionRates'], queryFn: getCommissionRates, enabled: isAdmin() })
  const { data: commissions = [], isLoading } = useQuery({
    queryKey: ['commissions'], queryFn: getCommissions, enabled: isAdmin(),
  })
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees, enabled: isAdmin() })

  const afterChange = () => {
    queryClient.invalidateQueries({ queryKey: ['commissions'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
  }

  const payeeMutation = useMutation({
    mutationFn: setCommissionPayee,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['commissions'] }); toast.success('Payee updated') },
    onError: (err) => toast.error(errMsg(err, 'Failed to update payee')),
  })
  const releaseMutation = useMutation({
    mutationFn: releaseCommission,
    onSuccess: () => { afterChange(); setReleaseTarget(null); toast.success('Commission released') },
    onError: (err) => toast.error(errMsg(err, 'Failed to release commission')),
  })
  const termsMutation = useMutation({
    mutationFn: setCommissionTerms,
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] })
      setTermsTarget(null)
      toast.success(vars.rate == null ? 'Commission back on the defaults' : 'Commission terms saved')
    },
    onError: (err) => toast.error(errMsg(err, 'Failed to save commission terms')),
  })
  const reverseMutation = useMutation({
    mutationFn: reverseCommission,
    onSuccess: () => { afterChange(); setReverseTarget(null); toast.success('Release reversed') },
    onError: (err) => toast.error(errMsg(err, 'Failed to reverse release')),
  })

  const activeEmployees = employees
    .filter(e => !e.archived)
    .map(e => ({ id: e.id, name: fullName(e), raw: e }))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Electrical Plan: anyone. Project Management: only the employee who is the
  // project's assigned PM — the backend enforces the same rule.
  const payeeOptions = (row) => row.commission_type === 'electrical_plan'
    ? activeEmployees
    : activeEmployees.filter(e => isProjectManager(e.raw, row.project_manager))

  const rows = commissions
    .map(r => ({ ...r, type_label: TYPE_LABELS[r.commission_type], amount_num: Number(r.amount) || 0 }))
    .filter(r => {
      const q = search.toLowerCase()
      const matchesSearch = !q || [r.project_name, r.project_reference_id, r.payee_name, r.project_manager]
        .some(v => v?.toLowerCase().includes(q))
      const matchesType = typeFilter === 'all' || r.commission_type === typeFilter
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'released' ? r.is_released : !r.is_released)
      return matchesSearch && matchesType && matchesStatus
    })

  const { sortKey, sortDir, toggle, sorted } = useSortable(rows, 'project_name', 'asc')
  const [toolbarRef, toolbarHeight] = useElementHeight()

  const toRelease = commissions.filter(r => !r.is_released).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const released = commissions.filter(r => r.is_released).reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const readyCount = commissions.filter(r => !r.is_released && r.payee_employee_id && !r.payee_issue && Number(r.amount) > 0).length

  if (!isAdmin()) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">You don&apos;t have access to this page.</div>
      </Layout>
    )
  }

  const openRelease = (row) => { setReleaseTarget(row); setReleaseDate(today()) }
  const isPM = (row) => row.commission_type === 'project_management'
  // Pre-filled with what the row uses now; the margin falls back to the
  // default when the row's method doesn't use one.
  const openTerms = (row) => {
    setTermsDraft({
      method: row.method || 'assumed_margin',
      rate: String(fractionToPct(row.rate)),
      margin: String(row.margin_rate != null ? fractionToPct(row.margin_rate) : Number(defaults?.project_management_margin ?? 20)),
    })
    setTermsTarget(row)
  }
  const termsValid = isValidPercent(termsDraft.rate)
    && (!termsTarget || !isPM(termsTarget) || termsDraft.method === 'actual' || isValidPercent(termsDraft.margin))
  const saveTerms = () => termsMutation.mutate({
    project_id: termsTarget.project_id,
    commission_type: termsTarget.commission_type,
    rate: termsDraft.rate.trim(),
    method: isPM(termsTarget) ? termsDraft.method : null,
    margin_rate: isPM(termsTarget) && isValidPercent(termsDraft.margin) ? termsDraft.margin.trim() : null,
  })
  const resetToDefaults = () => termsMutation.mutate({
    project_id: termsTarget.project_id, commission_type: termsTarget.commission_type, rate: null, method: null, margin_rate: null,
  })

  return (
    <Layout>
      <div className="p-8">
        <div ref={toolbarRef} className="sticky top-0 z-20 bg-gray-50 flow-root">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">Commissions</h1>
              <p className="text-sm text-gray-500 mt-1">
                Project Management shows once a project is <strong className="font-medium text-gray-700">Completed</strong>;
                Electrical Plan once the project&apos;s Electrical Plan is marked <strong className="font-medium text-gray-700">complete</strong>.
                Each commission can have its own method and rates (pencil icon); the rest follow the defaults
                {defaults && <> ({METHOD_LABELS[defaults.project_management_method].toLowerCase()}, {pctLabel(defaults.project_management)} PM,
                {' '}{pctLabel(defaults.project_management_margin)} margin, {pctLabel(defaults.electrical_plan)} Electrical Plan)</>}.
                Unreleased amounts update live; a released amount is fixed.
              </p>
            </div>
            <button onClick={() => navigate('/settings', { state: { tab: 'commissions' } })}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-700 bg-white hover:bg-gray-50">
              <SettingsIcon size={14} /> Defaults
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">Unreleased</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{peso(toRelease)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">Ready to release</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{readyCount}</p>
              <p className="text-[11px] text-gray-400">Payee set and amount above zero</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500">Released</p>
              <p className="text-lg font-semibold text-emerald-700 tabular-nums">{peso(released)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input id="commission-search" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
                placeholder="Search project, reference, or payee..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select id="commission-type-filter" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="all">All types</option>
              <option value="electrical_plan">Electrical Plan</option>
              <option value="project_management">Project Management</option>
            </select>
            <select id="commission-status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
              <option value="unreleased">Unreleased</option>
              <option value="released">Released</option>
              <option value="all">All status</option>
            </select>
          </div>
        </div>

        {/* No overflow-x-auto here: a scroll container breaks the sticky
            header below (it ends up offset by toolbarHeight *inside* the
            container, floating mid-table). Same structure as Billings. */}
        <div className="bg-white border border-gray-200 rounded-lg">
          {isLoading ? (
            <div className="text-center py-16 text-gray-400">Loading...</div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Search size={40} className="mx-auto mb-3 opacity-50" />
              <p>No commissions match your filters.</p>
              {commissions.length === 0 && (
                <p className="text-xs mt-2">
                  Commissions appear once a project is Completed (Project Management) or its Electrical Plan is marked complete.
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky z-10" style={{ top: toolbarHeight }}>
                <tr>
                  <SortableHeader label="Project" field="project_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <SortableHeader label="Type" field="type_label" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Basis</th>
                  <SortableHeader label="Amount" field="amount_num" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" align="right" />
                  <SortableHeader label="Payable To" field="payee_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <SortableHeader label="Status" field="is_released" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map(r => {
                  const base = Number(r.base) || 0
                  const amount = Number(r.amount) || 0
                  const options = payeeOptions(r)
                  const savingPayee = payeeMutation.isPending && payeeMutation.variables?.project_id === r.project_id
                    && payeeMutation.variables?.commission_type === r.commission_type
                  const canRelease = !r.is_released && r.payee_employee_id && !r.payee_issue && amount > 0
                  const releaseHint = r.is_released ? undefined
                    : !r.payee_employee_id ? 'Choose who this is payable to first'
                    : r.payee_issue ? r.payee_issue
                    : amount <= 0 ? 'Nothing to release — the amount is zero'
                    : 'Mark paid and record it as a project expense'
                  // A saved payee who isn't in this row's pickable list: either
                  // archived since (still payable — they earned it) or, on a
                  // PM commission, no longer the project's PM (payee_issue).
                  const savedNotListed = r.payee_employee_id && !options.some(o => o.id === r.payee_employee_id)
                  return (
                    <tr key={rowKey(r)} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.project_name}</p>
                        <p className="text-xs text-gray-400 font-mono">
                          {r.project_reference_id || '—'}{r.project_status && r.project_status !== 'Active' ? ` · ${r.project_status}` : ''}
                        </p>
                        {r.project_archived && (
                          <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500"
                            title="Project is archived — only its released commissions are shown, so they can still be reversed">
                            Archived project
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${TYPE_PILLS[r.commission_type]}`}>{r.type_label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 tabular-nums whitespace-nowrap">
                        <div className="flex items-start gap-2">
                          <div>
                            {r.is_released || !isPM(r) ? (
                              <>
                                <span>{peso(base)}</span>
                                <span className="text-gray-400"> × {rowRatePct(r.rate)}</span>
                              </>
                            ) : r.method === 'actual' ? (
                              <>
                                <span className="text-gray-400">(</span>{peso(r.project_cost)}<span className="text-gray-400"> − </span>{peso(totalExpenses(r))}<span className="text-gray-400">)</span>
                                <span className="text-gray-400"> × {rowRatePct(r.rate)}</span>
                              </>
                            ) : (
                              <>
                                {peso(r.project_cost)}<span className="text-gray-400"> × {rowRatePct(r.margin_rate)} × {rowRatePct(r.rate)}</span>
                              </>
                            )}
                            {isPM(r) && (
                              <p className="text-[11px] text-gray-400">
                                {METHOD_LABELS[r.method]}
                                {r.is_released && r.margin_rate != null && ` (${rowRatePct(r.margin_rate)} margin)`}
                                {!r.is_released && r.method === 'actual' && base < 0 && <span className="text-red-600"> · expenses exceed project cost</span>}
                              </p>
                            )}
                            {!r.is_released && r.method === 'actual' && (
                              <p className="text-[11px] text-gray-400"
                                title="Only expenses tagged to this project count. Office expenses and commission payouts are left out.">
                                Materials {peso(r.expenses_materials)} · Other {peso(r.expenses_other)} · Labor {peso(r.expenses_labor)}
                              </p>
                            )}
                            {r.custom_terms && (
                              <span className="mt-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700"
                                title="This commission has its own terms — changing the defaults doesn't affect it">
                                Own terms
                              </span>
                            )}
                          </div>
                          {!r.is_released && (
                            <button onClick={() => openTerms(r)} title="Edit method and rates for this commission"
                              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums whitespace-nowrap">{peso(amount)}</td>
                      <td className="px-4 py-3 min-w-[220px]">
                        {r.is_released ? (
                          <span className="inline-flex items-center gap-1.5 text-gray-700">
                            <Lock size={12} className="text-gray-400" /> {r.payee_name || '—'}
                          </span>
                        ) : r.commission_type === 'project_management' && options.length === 0 && !r.payee_employee_id ? (
                          <p className="text-xs text-amber-700">
                            {r.project_manager
                              ? `No active employee matches this project's PM (${r.project_manager}).`
                              : 'No Project Manager assigned on this project yet.'}
                          </p>
                        ) : (
                          <>
                            {/* Always a dropdown once a payee is saved, even when nobody
                                else is eligible — otherwise a stale payee couldn't be cleared. */}
                            <select id={`payee-${rowKey(r)}`} value={r.payee_employee_id ?? ''} disabled={savingPayee}
                              onChange={e => payeeMutation.mutate({
                                project_id: r.project_id,
                                commission_type: r.commission_type,
                                payee_employee_id: e.target.value === '' ? null : Number(e.target.value),
                              })}
                              className={`w-full border rounded-md text-sm px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-60 ${
                                r.payee_issue ? 'border-amber-400' : 'border-gray-300'
                              }`}>
                              <option value="">Select payee…</option>
                              {/* Shown so the current value reads correctly, but not re-pickable —
                                  the server only accepts active, eligible employees. */}
                              {savedNotListed && (
                                <option value={r.payee_employee_id} disabled>
                                  {r.payee_name}{r.payee_issue ? ' (no longer the PM)' : ' (archived)'}
                                </option>
                              )}
                              {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                            {r.payee_issue && <p className="mt-1 text-xs text-amber-700">{r.payee_issue}</p>}
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.is_released ? (
                          <span className="inline-flex flex-col">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 w-fit">Released</span>
                            {r.released_date && (
                              <span className="text-[11px] text-gray-400 mt-1">{format(new Date(r.released_date + 'T00:00:00'), 'MMM d, yyyy')}</span>
                            )}
                          </span>
                        ) : (
                          <button onClick={() => openRelease(r)} disabled={!canRelease} title={releaseHint}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed">
                            Close &amp; Release Payment
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {r.is_released && (
                            <button onClick={() => setReverseTarget(r)} title="Reverse release (Admin)"
                              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600">
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <button onClick={() => navigate(`/projects/${r.project_id}`)} title="View project"
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                            <ArrowUpRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {releaseTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setReleaseTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-base font-semibold text-gray-900">Close &amp; Release Payment</h3>
              <button onClick={() => setReleaseTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                <dt className="text-gray-500">Project</dt><dd className="text-gray-900 font-medium">{releaseTarget.project_name}</dd>
                <dt className="text-gray-500">Commission</dt><dd className="text-gray-900">{TYPE_LABELS[releaseTarget.commission_type]}</dd>
                <dt className="text-gray-500">Payable to</dt><dd className="text-gray-900">{releaseTarget.payee_name}</dd>
                <dt className="text-gray-500">Amount</dt><dd className="text-gray-900 font-semibold tabular-nums">{peso(releaseTarget.amount)}</dd>
              </dl>
              <div>
                <label htmlFor="commission-release-date" className="block text-xs font-medium text-gray-700 mb-1">Release date</label>
                <input id="commission-release-date" type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <p className="text-xs text-gray-500">
                This records {peso(releaseTarget.amount)} as a Commission expense on the project and locks the commission.
                The amount is recalculated from current figures at the moment you release, so it may differ slightly if
                costs changed since this page loaded.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setReleaseTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">Cancel</button>
              <button disabled={releaseMutation.isPending || !releaseDate}
                onClick={() => releaseMutation.mutate({
                  project_id: releaseTarget.project_id,
                  commission_type: releaseTarget.commission_type,
                  release_date: releaseDate,
                })}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">
                {releaseMutation.isPending ? 'Releasing…' : 'Release payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {termsTarget && (() => {
        const pm = isPM(termsTarget)
        const usesMargin = pm && termsDraft.method === 'assumed_margin'
        const percentInput = (id, key, disabled) => (
          <div className={`relative w-28 ${disabled || isValidPercent(termsDraft[key]) ? '' : 'rounded-md ring-1 ring-red-400'}`}>
            <input id={id} type="text" inputMode="decimal" value={termsDraft[key]} disabled={disabled}
              onChange={e => isTypablePercent(e.target.value) && setTermsDraft(d => ({ ...d, [key]: e.target.value }))}
              className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded-md text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
          </div>
        )
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setTermsTarget(null)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{TYPE_LABELS[termsTarget.commission_type]} commission</h3>
                  <p className="text-xs text-gray-500">{termsTarget.project_name}</p>
                </div>
                <button onClick={() => setTermsTarget(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
              </div>
              <form className="px-6 py-4 space-y-4 text-sm" onSubmit={e => { e.preventDefault(); if (termsValid) saveTerms() }}>
                {pm && (
                  <fieldset className="space-y-2">
                    <legend className="block text-xs font-medium text-gray-700 mb-1">Method</legend>
                    {Object.entries(METHOD_LABELS).map(([value, label]) => (
                      <label key={value} className="flex items-start gap-2 cursor-pointer">
                        <input type="radio" name="commission-method" value={value} className="mt-0.5"
                          checked={termsDraft.method === value} onChange={() => setTermsDraft(d => ({ ...d, method: value }))} />
                        <span>
                          <span className="text-gray-900">{label}</span>
                          <span className="block text-xs text-gray-500">{METHOD_FORMULAS[value]}</span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <div className="flex flex-wrap gap-6">
                  <div>
                    <label htmlFor="terms-rate" className="block text-xs font-medium text-gray-700 mb-1">Commission rate</label>
                    {percentInput('terms-rate', 'rate', false)}
                  </div>
                  {pm && (
                    <div>
                      <label htmlFor="terms-margin" className="block text-xs font-medium text-gray-700 mb-1">Margin</label>
                      {percentInput('terms-margin', 'margin', !usesMargin)}
                      {!usesMargin && <p className="text-[11px] text-gray-400 mt-1">Not used: cost − expenses is the margin</p>}
                    </div>
                  )}
                </div>
                <div className="rounded-md bg-gray-50 px-3 py-2">
                  <p className="text-xs text-gray-500">Amount with these terms</p>
                  <p className="text-base font-semibold text-gray-900 tabular-nums">{termsValid ? peso(previewAmount(termsTarget, termsDraft)) : '—'}</p>
                </div>
                <p className="text-xs text-gray-500">
                  Saved terms belong to this commission only; changing the defaults in Settings won&apos;t affect it.
                  They lock when the commission is released.
                </p>
                <div className="flex items-center justify-between gap-2 pt-2">
                  {termsTarget.custom_terms ? (
                    <button type="button" onClick={resetToDefaults} disabled={termsMutation.isPending}
                      className="text-xs text-gray-500 hover:text-gray-800 underline disabled:opacity-50">Use defaults instead</button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setTermsTarget(null)}
                      className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">Cancel</button>
                    <button type="submit" disabled={termsMutation.isPending || !termsValid}
                      className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">
                      {termsMutation.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )
      })()}

      {reverseTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setReverseTarget(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 space-y-3 text-sm">
              <h3 className="text-base font-semibold text-gray-900">Reverse this release?</h3>
              <p className="text-gray-600">
                The {peso(reverseTarget.amount)} {TYPE_LABELS[reverseTarget.commission_type]} commission for{' '}
                <span className="font-medium text-gray-900">{reverseTarget.project_name}</span> goes back to unreleased,
                and its Commission expense is removed from the project. The amount will be recalculated from the
                project&apos;s current figures.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={() => setReverseTarget(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700">Cancel</button>
              <button disabled={reverseMutation.isPending} onClick={() => reverseMutation.mutate(reverseTarget.id)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                {reverseMutation.isPending ? 'Reversing…' : 'Reverse release'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
