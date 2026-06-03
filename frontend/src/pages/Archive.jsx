import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { RotateCcw, Trash2, X, AlertTriangle } from 'lucide-react'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import {
  getArchivedEmployees, getArchivedProjects, getArchivedMaterials,
  getArchivedTransactions, getArchivedSuppliers,
  restoreEmployee, restoreProject, restoreMaterial,
  restoreTransaction, restoreSupplier,
  permanentDeleteEmployee, permanentDeleteProject, permanentDeleteMaterial,
  permanentDeleteTransaction, permanentDeleteSupplier,
} from '../api/archive'

const fmt = (n) => `₱${Number(n || 0).toLocaleString()}`

const TABS = [
  { key: 'employees',    label: 'Employees' },
  { key: 'projects',     label: 'Projects' },
  { key: 'materials',    label: 'Materials' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'suppliers',    label: 'Suppliers' },
]

const TX_TYPE_COLORS = {
  Payment: 'bg-green-100 text-green-700',
  'Materials Procurement': 'bg-blue-100 text-blue-700',
  'Outgoing Materials': 'bg-red-100 text-red-700',
  'Incoming Materials': 'bg-emerald-100 text-emerald-700',
  'General Expenditure': 'bg-amber-100 text-amber-700',
}

function ConfirmDeleteModal({ item, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Permanently Delete</h3>
        </div>
        <p className="text-sm text-gray-600 mb-2">
          You are about to permanently delete <strong>{item.label}</strong>.
        </p>
        <p className="text-sm text-red-600 font-medium mb-6">
          This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
            <Trash2 size={14} />
            {loading ? 'Deleting...' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ArchivedTable({ columns, rows, onRestore, onDelete, isAdmin, restoring, deleting }) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No archived items in this category.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            {columns.map(col => (
              <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                {col}
              </th>
            ))}
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(({ id, cells }) => (
            <tr key={id} className="hover:bg-gray-50">
              {cells.map((cell, i) => (
                <td key={i} className="px-4 py-3 text-gray-700">{cell}</td>
              ))}
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <button
                    onClick={() => onRestore(id)}
                    disabled={restoring === id}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                    title="Restore">
                    <RotateCcw size={13} />
                    {restoring === id ? 'Restoring...' : 'Restore'}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => onDelete(id)}
                      disabled={deleting === id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      title="Permanently delete">
                      <Trash2 size={13} />
                      Delete Forever
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Archive() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('employees')
  const [restoringId, setRestoringId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null) // { id, label, type }

  // ── Queries ──────────────────────────────────────────────────────────
  const { data: archivedEmployees = []    } = useQuery({ queryKey: ['archived', 'employees'],    queryFn: getArchivedEmployees,    enabled: activeTab === 'employees' })
  const { data: archivedProjects = []     } = useQuery({ queryKey: ['archived', 'projects'],     queryFn: getArchivedProjects,     enabled: activeTab === 'projects' })
  const { data: archivedMaterials = []    } = useQuery({ queryKey: ['archived', 'materials'],    queryFn: getArchivedMaterials,    enabled: activeTab === 'materials' })
  const { data: archivedTransactions = [] } = useQuery({ queryKey: ['archived', 'transactions'], queryFn: getArchivedTransactions, enabled: activeTab === 'transactions' })
  const { data: archivedSuppliers = []    } = useQuery({ queryKey: ['archived', 'suppliers'],    queryFn: getArchivedSuppliers,    enabled: activeTab === 'suppliers' })

  // ── Restore mutations ─────────────────────────────────────────────────
  const makeMutation = (fn, keys, successMsg) => useMutation({
    mutationFn: fn,
    onSuccess: () => {
      keys.forEach(k => queryClient.invalidateQueries({ queryKey: k }))
      toast.success(successMsg)
      setRestoringId(null)
      setConfirmDelete(null)
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || 'Action failed')
      setRestoringId(null)
    },
  })

  const restoreEmp  = makeMutation(restoreEmployee,    [['archived', 'employees'], ['employees']],       'Employee restored')
  const restorePrj  = makeMutation(restoreProject,     [['archived', 'projects'],  ['projects']],        'Project restored')
  const restoreMat  = makeMutation(restoreMaterial,    [['archived', 'materials'], ['materials']],       'Material restored')
  const restoreTx   = makeMutation(restoreTransaction, [['archived', 'transactions'], ['transactions']], 'Transaction restored')
  const restoreSup  = makeMutation(restoreSupplier,    [['archived', 'suppliers'], ['suppliers']],       'Supplier restored')

  const deleteEmp  = makeMutation(permanentDeleteEmployee,    [['archived', 'employees']],    'Employee permanently deleted')
  const deletePrj  = makeMutation(permanentDeleteProject,     [['archived', 'projects']],     'Project permanently deleted')
  const deleteMat  = makeMutation(permanentDeleteMaterial,    [['archived', 'materials']],    'Material permanently deleted')
  const deleteTx   = makeMutation(permanentDeleteTransaction, [['archived', 'transactions']], 'Transaction permanently deleted')
  const deleteSup  = makeMutation(permanentDeleteSupplier,    [['archived', 'suppliers']],    'Supplier permanently deleted')

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleRestore = (type, id) => {
    setRestoringId(id)
    const map = { employees: restoreEmp, projects: restorePrj, materials: restoreMat, transactions: restoreTx, suppliers: restoreSup }
    map[type].mutate(id)
  }

  const handleDeleteConfirm = () => {
    const map = { employees: deleteEmp, projects: deletePrj, materials: deleteMat, transactions: deleteTx, suppliers: deleteSup }
    map[confirmDelete.type].mutate(confirmDelete.id)
  }

  // ── Row builders ─────────────────────────────────────────────────────
  const employeeRows = archivedEmployees.map(e => ({
    id: e.id,
    cells: [
      `${e.first_name} ${e.middle_name ? e.middle_name + ' ' : ''}${e.last_name}`,
      e.email || '-',
      e.status,
      e.date_hired ? format(new Date(e.date_hired), 'MMM d, yyyy') : '-',
    ],
  }))

  const projectRows = archivedProjects.map(p => ({
    id: p.id,
    cells: [p.project_name, p.owner_company_name || '-', p.status || '-'],
  }))

  const materialRows = archivedMaterials.map(m => ({
    id: m.id,
    cells: [m.rating_size, m.material_type || '-', m.unit || '-'],
  }))

  const transactionRows = archivedTransactions.map(tx => ({
    id: tx.id,
    cells: [
      <span key="type" className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_TYPE_COLORS[tx.transaction_type] || 'bg-gray-100 text-gray-600'}`}>
        {tx.transaction_type}
      </span>,
      tx.transaction_date ? format(new Date(tx.transaction_date + 'T00:00:00'), 'MMM d, yyyy') : '-',
      tx.project_name || (tx.is_office_expense ? 'Office' : '-'),
      <span key="amt" className={tx.transaction_type === 'Payment' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
        {fmt(tx.amount)}
      </span>,
    ],
  }))

  const supplierRows = archivedSuppliers.map(s => ({
    id: s.id,
    cells: [s.name, s.contact_person || '-', s.phone || '-'],
  }))

  // ── Tab config ────────────────────────────────────────────────────────
  const tabConfig = {
    employees:    { columns: ['Name', 'Email', 'Status', 'Date Hired'],                          rows: employeeRows,    restoreFn: id => handleRestore('employees', id),    deleteFn: (id, row) => setConfirmDelete({ id, type: 'employees',    label: row.cells[0] }),    isPending: restoreEmp.isPending || deleteEmp.isPending },
    projects:     { columns: ['Project Name', 'Owner', 'Status'],                                rows: projectRows,     restoreFn: id => handleRestore('projects', id),     deleteFn: (id, row) => setConfirmDelete({ id, type: 'projects',     label: row.cells[0] }),    isPending: restorePrj.isPending || deletePrj.isPending },
    materials:    { columns: ['Name / Size', 'Type', 'Unit'],                                    rows: materialRows,    restoreFn: id => handleRestore('materials', id),    deleteFn: (id, row) => setConfirmDelete({ id, type: 'materials',    label: row.cells[0] }),    isPending: restoreMat.isPending || deleteMat.isPending },
    transactions: { columns: ['Type', 'Date', 'Project', 'Amount'],                              rows: transactionRows, restoreFn: id => handleRestore('transactions', id), deleteFn: (id, row) => setConfirmDelete({ id, type: 'transactions', label: `Transaction #${id}` }), isPending: restoreTx.isPending || deleteTx.isPending },
    suppliers:    { columns: ['Name', 'Contact Person', 'Phone'],                                rows: supplierRows,    restoreFn: id => handleRestore('suppliers', id),    deleteFn: (id, row) => setConfirmDelete({ id, type: 'suppliers',    label: row.cells[0] }),    isPending: restoreSup.isPending || deleteSup.isPending },
  }

  const current = tabConfig[activeTab]

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Archive</h1>
          <p className="text-sm text-gray-500 mt-1">
            Archived records — restore them or permanently delete.
            {isAdmin() && <span className="ml-1 text-red-600 font-medium">Permanent delete is irreversible.</span>}
          </p>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ArchivedTable
            columns={current.columns}
            rows={current.rows}
            onRestore={current.restoreFn}
            onDelete={(id) => {
              const row = current.rows.find(r => r.id === id)
              current.deleteFn(id, row)
            }}
            isAdmin={isAdmin()}
            restoring={restoringId}
            deleting={null}
          />
        </div>
      </div>

      {/* Permanent Delete Confirmation */}
      {confirmDelete && (
        <ConfirmDeleteModal
          item={confirmDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDelete(null)}
          loading={tabConfig[confirmDelete.type].isPending}
        />
      )}
    </Layout>
  )
}
