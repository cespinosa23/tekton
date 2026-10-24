import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import Layout from '../components/Layout'
import { getProjects } from '../api/projects'
import { getBillings, setBillingPaid } from '../api/billing'
import { getCompanies } from '../api/settings'
import { formatBillingSerial } from '../utils/billingSerial'
import MarkPaidDialog from '../components/MarkPaidDialog'
import PrintBillingDialog from '../components/PrintBillingDialog'
import { toast } from 'sonner'
import { usePermissions } from '../hooks/usePermissions'
import { Search, CheckCircle, Clock, Printer, ArrowUpRight } from 'lucide-react'
import { useSortable } from '../hooks/useSortable'
import { SortableHeader } from '../components/SortableHeader'
import { useElementHeight } from '../hooks/useElementHeight'
import { apiErrorMessage } from '../utils/apiError'

const BILLING_TYPE_LABELS = { down_payment: 'Down Payment', progress: 'Progress Billing', retention_release: 'Retention Release' }

const fmt = (n) => `₱${Number(n || 0).toLocaleString()}`

export default function Billings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { canWrite } = usePermissions()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [printPickerFor, setPrintPickerFor] = useState(null)

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: billings = [] } = useQuery({ queryKey: ['billings'], queryFn: getBillings })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies })

  const [markPaidFor, setMarkPaidFor] = useState(null) // billing row awaiting a paid date
  const paidMutation = useMutation({
    mutationFn: setBillingPaid,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billings'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      setMarkPaidFor(null)
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to update the billing')),
  })

  // Marking paid asks for the actual date paid first (MarkPaidDialog);
  // marking unpaid goes straight through.
  const handleTogglePaid = (billing) => {
    if (billing.is_paid) paidMutation.mutate({ id: billing.id, is_paid: false, paid_date: null })
    else setMarkPaidFor(billing)
  }

  const rows = billings
    .map(b => {
      const project = projects.find(p => p.id === b.project_id)
      return {
        ...b,
        project,
        project_name: project?.project_name || '',
        owner_company_name: project?.owner_company_name || '',
        serial: formatBillingSerial(b),
        type_label: BILLING_TYPE_LABELS[b.billing_type] || b.billing_type,
      }
    })
    .filter(b => b.project)
    .filter(b => {
      const term = search.toLowerCase()
      const matchesSearch = !term ||
        b.project.project_name?.toLowerCase().includes(term) ||
        b.project.owner_company_name?.toLowerCase().includes(term) ||
        formatBillingSerial(b).toLowerCase().includes(term)
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'paid' && b.is_paid) ||
        (statusFilter === 'unpaid' && !b.is_paid)
      return matchesSearch && matchesStatus
    })

  const { sortKey, sortDir, toggle, sorted } = useSortable(rows, 'id', 'desc')
  const [toolbarRef, toolbarHeight] = useElementHeight()

  if (!canWrite('billing')) {
    return (
      <Layout>
        <div className="p-8 text-center text-gray-400">You don&apos;t have access to this page.</div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="p-8">
        <div ref={toolbarRef} className="sticky top-0 z-20 bg-gray-50 flow-root">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Billings</h1>
          <p className="text-sm text-gray-500 mt-1">Every billing entry across all projects, in one place</p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Search by project, client, or serial..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg">
          {rows.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Search size={40} className="mx-auto mb-3 opacity-50" />
              <p>No billings match your filters.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky z-10" style={{ top: toolbarHeight }}>
                <tr>
                  <SortableHeader label="Serial" field="serial" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <SortableHeader label="Project" field="project_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <SortableHeader label="Client" field="owner_company_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <SortableHeader label="Type" field="type_label" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <SortableHeader label="Billing Date" field="billing_date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <SortableHeader label="Amount" field="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" align="right" />
                  <SortableHeader label="Paid" field="is_paid" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" align="center" />
                  <SortableHeader label="Paid Date" field="paid_date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map(b => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 text-xs font-mono">{formatBillingSerial(b)}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{b.project.project_name}</td>
                    <td className="px-4 py-3 text-gray-600">{b.project.owner_company_name}</td>
                    <td className="px-4 py-3 text-gray-600">{BILLING_TYPE_LABELS[b.billing_type] || b.billing_type}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {b.billing_date ? format(new Date(b.billing_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">{fmt(b.amount)}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleTogglePaid(b)} disabled={paidMutation.isPending || parseFloat(b.amount) === 0}
                        title={parseFloat(b.amount) === 0 ? 'Zero-amount billing — always paid' : b.is_paid && b.paid_date ? `Paid on ${b.paid_date}` : 'Mark as paid'}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          b.is_paid ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {b.is_paid ? <CheckCircle size={12} /> : <Clock size={12} />}
                        {b.is_paid ? 'Paid' : 'Unpaid'}
                      </button>
                    </td>
                    {/* When it was paid (what a payment's date edit in Transactions changes); Billing Date is when it was issued. */}
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {b.is_paid && b.paid_date ? format(new Date(b.paid_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => navigate(`/projects/${b.project_id}`)}
                          title="View project" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          <ArrowUpRight size={14} />
                        </button>
                        <button onClick={() => setPrintPickerFor(b)}
                          title="Print billing request" className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          <Printer size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Print: company profile + date on the letter */}
      {printPickerFor && (
        <PrintBillingDialog billing={printPickerFor} companies={companies} onClose={() => setPrintPickerFor(null)} />
      )}
      {markPaidFor && (
        <MarkPaidDialog billing={markPaidFor} projectName={markPaidFor.project?.project_name}
          loading={paidMutation.isPending}
          onCancel={() => setMarkPaidFor(null)}
          onConfirm={(date) => paidMutation.mutate({ id: markPaidFor.id, is_paid: true, paid_date: date })} />
      )}
    </Layout>
  )
}
