import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Navigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { getProjects, getEmployees } from '../api/dashboard'
import { listAttendance } from '../api/lists'
import { getProjectTotals, getMonthlyTrend, totalsFor } from '../api/reports'
import { useAuth } from '../context/AuthContext'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { TrendingUp, Users, Building2, BarChart2, ChevronUp, ChevronDown } from 'lucide-react'

const COLORS = ['#8b5cf6', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#ec4899']

const fmt = (n) => `₱${(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
const pct = (n) => `${(n || 0).toFixed(1)}%`

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
        <Icon size={18} className="text-gray-500" />
        <h2 className="font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function SortTh({ label, field, sort, setSort, className = '' }) {
  const active = sort.field === field
  return (
    <th
      onClick={() => setSort(s => ({ field, dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc' }))}
      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-800 ${className}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />) : null}
      </span>
    </th>
  )
}

export default function Reports() {
  const { isAdmin } = useAuth()
  const admin = isAdmin()

  // Hooks run before the Admin redirect below, never after an early return.
  // Cache keys match every other page: employees was cached under
  // 'attendance' here, so after visiting Reports, Dashboard/Projects/Attendance
  // briefly showed the employee list as attendance records (and vice versa).
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects, enabled: admin })
  const { data: employees = [] } = useQuery({ queryKey: ['employees'], queryFn: getEmployees, enabled: admin })
  // Totals are added up on the server (api/reports.py, same formulas this
  // page used to run over every transaction and attendance record).
  const { data: projectTotals } = useQuery({ queryKey: ['projectTotals'], queryFn: getProjectTotals, enabled: admin })
  const trendEndMonth = format(new Date(), 'yyyy-MM') // the browser's month, not the server's
  const { data: monthlyTrend = [] } = useQuery({
    queryKey: ['monthlyTrend', trendEndMonth, 6],
    queryFn: () => getMonthlyTrend({ endMonth: trendEndMonth, months: 6 }),
    enabled: admin,
  })
  // Manpower utilization needs only this month's attendance.
  const monthStart = startOfMonth(new Date())
  const monthEnd = endOfMonth(new Date())
  const thisMonthRange = { start: format(monthStart, 'yyyy-MM-dd'), end: format(monthEnd, 'yyyy-MM-dd') }
  const { data: thisMonthAtt = [] } = useQuery({
    queryKey: ['attendance', 'range', thisMonthRange.start, thisMonthRange.end],
    queryFn: () => listAttendance(thisMonthRange),
    enabled: admin,
  })

  const [profitSort, setProfitSort] = useState({ field: 'margin', dir: 'asc' })
  const [statusFilter, setStatusFilter] = useState('all')

  if (!admin) return <Navigate to="/dashboard" replace />

  // ── Per-project financials ─────────────────────────────────────────────────
  const projectData = projects.map(project => {
    const totalContract = parseFloat(project.contract_cost) || 0

    // Server totals: labor (Direct Hire excluded), materials (line costs,
    // returns netted), other costs, payments.
    const { laborCost, materialsCost, othersCost, totalPaid } = totalsFor(projectTotals, project.id)
    const totalExpenses = laborCost + materialsCost + othersCost
    const outstanding = totalContract - totalPaid
    const margin = totalContract > 0 ? ((totalPaid - totalExpenses) / totalContract) * 100 : 0

    return {
      id: project.id,
      name: project.project_name,
      client: project.owner_company_name,
      status: project.status,
      totalContract,
      totalExpenses,
      totalPaid,
      outstanding,
      margin,
    }
  })

  const filteredProjects = statusFilter === 'all'
    ? projectData
    : projectData.filter(p => p.status === statusFilter)

  const sortedProjects = [...filteredProjects].sort((a, b) => {
    const v = profitSort.dir === 'asc' ? 1 : -1
    if (typeof a[profitSort.field] === 'string') return v * a[profitSort.field].localeCompare(b[profitSort.field])
    return v * (a[profitSort.field] - b[profitSort.field])
  })

  // ── 6-month revenue vs expense trend ──────────────────────────────────────
  // Server-side per month (revenue, labor, materials netted by amount, general).
  const monthlyData = monthlyTrend.map(m => {
    const revenue = parseFloat(m.revenue) || 0
    const expenses = (parseFloat(m.labor) || 0) + (parseFloat(m.materials) || 0) + (parseFloat(m.general) || 0)
    return { month: format(new Date(m.month + '-01T00:00:00'), 'MMM yy'), revenue, expenses, net: revenue - expenses }
  })

  // ── Top clients by payments received ──────────────────────────────────────
  // Payments per project (server totals) grouped by client; payments with no
  // project (or a project no longer listed) count as "Unknown", as before.
  const clientMap = {}
  const addClient = (client, amount) => { if (amount) clientMap[client] = (clientMap[client] || 0) + amount }
  Object.entries(projectTotals?.projects || {}).forEach(([pid, t]) => {
    const proj = projects.find(p => p.id === parseInt(pid))
    addClient(proj?.owner_company_name || 'Unknown', parseFloat(t.total_paid) || 0)
  })
  addClient('Unknown', parseFloat(projectTotals?.unassigned?.total_paid) || 0)
  const topClients = Object.entries(clientMap)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8)
  const maxClientRevenue = topClients[0]?.revenue || 1

  // ── Expense category breakdown ─────────────────────────────────────────────
  // All-time totals: every project plus records with no project (office),
  // same as summing every record. Direct Hire labor excluded; materials by
  // line cost with returns netted (matches the profitability table above).
  const allBuckets = [...Object.values(projectTotals?.projects || {}), ...(projectTotals?.unassigned ? [projectTotals.unassigned] : [])]
  const sumField = (f) => allBuckets.reduce((s, t) => s + (parseFloat(t[f]) || 0), 0)
  const totalLabor = sumField('labor_cost')
  const totalMaterials = sumField('materials_cost')
  const totalGeneral = sumField('others_cost')
  const expensePie = [
    { name: 'Labor', value: totalLabor },
    { name: 'Materials', value: totalMaterials },
    { name: 'General', value: totalGeneral },
  ].filter(e => e.value > 0)
  const totalAllExpenses = totalLabor + totalMaterials + totalGeneral

  // ── Manpower utilization this month ───────────────────────────────────────
  // thisMonthAtt is fetched for this month only (see the queries above).
  const activeEmployeeCount = employees.filter(e => e.status === 'Active').length
  const deployedIds = new Set(thisMonthAtt.map(a => a.employee_id))
  const deployedCount = deployedIds.size
  const utilizationPct = activeEmployeeCount > 0 ? (deployedCount / activeEmployeeCount) * 100 : 0

  const projectStatuses = ['all', ...new Set(projects.map(p => p.status).filter(Boolean))]

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Admin view — all projects, all time unless noted</p>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Revenue', value: fmt(projectData.reduce((s, p) => s + p.totalPaid, 0)), sub: 'All payments received' },
            { label: 'Total Expenses', value: fmt(totalAllExpenses), sub: 'Labor + Materials + General' },
            { label: 'Total Outstanding AR', value: fmt(projectData.filter(p => p.outstanding > 0).reduce((s, p) => s + p.outstanding, 0)), sub: `${projectData.filter(p => p.outstanding > 0).length} projects unpaid` },
            { label: 'Manpower This Month', value: `${deployedCount} / ${activeEmployeeCount}`, sub: `${utilizationPct.toFixed(0)}% deployed` },
          ].map(kpi => (
            <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500">{kpi.label}</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Revenue vs Expense Trend */}
        <Section icon={TrendingUp} title="Revenue vs. Expense Trend (6 months)">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={monthlyData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `₱${v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={(v, n) => [fmt(v), n]} />
              <Legend />
              <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
              <Line dataKey="net" name="Net" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </Section>

        {/* Expense Breakdown + Top Clients side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expense category donut */}
          <Section icon={BarChart2} title="Expense Breakdown (All Time)">
            {expensePie.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No expense data</p>
            ) : (
              <div className="flex items-center gap-6">
                <PieChart width={160} height={160}>
                  <Pie data={expensePie} dataKey="value" cx={75} cy={75} innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {expensePie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
                <div className="flex-1 space-y-3">
                  {expensePie.map((e, i) => (
                    <div key={e.name}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-gray-700">{e.name}</span>
                        </span>
                        <span className="font-semibold text-gray-900">{fmt(e.value)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(e.value / totalAllExpenses) * 100}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 text-right">{pct((e.value / totalAllExpenses) * 100)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* Top clients */}
          <Section icon={Building2} title="Top Clients by Revenue">
            {topClients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No payment data</p>
            ) : (
              <div className="space-y-3">
                {topClients.map((c, i) => (
                  <div key={c.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 truncate max-w-[60%]">{c.name}</span>
                      <span className="font-semibold text-gray-900 whitespace-nowrap">{fmt(c.revenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(c.revenue / maxClientRevenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Manpower utilization */}
        <Section icon={Users} title={`Manpower Utilization — ${format(monthStart, 'MMMM yyyy')}`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke={utilizationPct >= 75 ? '#10b981' : utilizationPct >= 40 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${utilizationPct} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">{utilizationPct.toFixed(0)}%</span>
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{deployedCount}</p>
                <p className="text-sm text-gray-500">of {activeEmployeeCount} active employees deployed</p>
                <p className="text-xs text-gray-400 mt-1">Based on attendance records this month</p>
              </div>
            </div>
            <div className="flex-1 sm:border-l sm:pl-6 border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deployed this month</p>
              <div className="flex flex-wrap gap-1.5">
                {employees
                  .filter(e => deployedIds.has(e.id))
                  .slice(0, 20)
                  .map(e => (
                    <span key={e.id} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-xs">
                      {[e.first_name, e.last_name].filter(Boolean).join(' ')}
                    </span>
                  ))}
                {deployedIds.size > 20 && <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">+{deployedIds.size - 20} more</span>}
              </div>
            </div>
          </div>
        </Section>

        {/* Project Profitability Table */}
        <Section icon={TrendingUp} title="Project Profitability">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-gray-500">Status:</span>
            {projectStatuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <SortTh label="Project" field="name" sort={profitSort} setSort={setProfitSort} />
                  <SortTh label="Client" field="client" sort={profitSort} setSort={setProfitSort} />
                  <SortTh label="Status" field="status" sort={profitSort} setSort={setProfitSort} />
                  <SortTh label="Contract" field="totalContract" sort={profitSort} setSort={setProfitSort} className="text-right" />
                  <SortTh label="Expenses" field="totalExpenses" sort={profitSort} setSort={setProfitSort} className="text-right" />
                  <SortTh label="Received" field="totalPaid" sort={profitSort} setSort={setProfitSort} className="text-right" />
                  <SortTh label="Outstanding" field="outstanding" sort={profitSort} setSort={setProfitSort} className="text-right" />
                  <SortTh label="Margin" field="margin" sort={profitSort} setSort={setProfitSort} className="text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedProjects.map(p => {
                  const marginColor = p.margin >= 20 ? 'text-emerald-600' : p.margin >= 0 ? 'text-amber-600' : 'text-red-600'
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{p.name}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[140px] truncate">{p.client}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : p.status === 'Completed' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(p.totalContract)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(p.totalExpenses)}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{fmt(p.totalPaid)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${p.outstanding > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(p.outstanding)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${marginColor}`}>{pct(p.margin)}</td>
                    </tr>
                  )
                })}
                {sortedProjects.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No projects</td></tr>
                )}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="font-semibold text-gray-700">
                  <td className="px-4 py-3" colSpan={3}>Totals ({sortedProjects.length} projects)</td>
                  <td className="px-4 py-3 text-right">{fmt(sortedProjects.reduce((s, p) => s + p.totalContract, 0))}</td>
                  <td className="px-4 py-3 text-right">{fmt(sortedProjects.reduce((s, p) => s + p.totalExpenses, 0))}</td>
                  <td className="px-4 py-3 text-right">{fmt(sortedProjects.reduce((s, p) => s + p.totalPaid, 0))}</td>
                  <td className="px-4 py-3 text-right text-red-600">{fmt(sortedProjects.filter(p => p.outstanding > 0).reduce((s, p) => s + p.outstanding, 0))}</td>
                  <td className="px-4 py-3 text-right">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>
      </div>
    </Layout>
  )
}
