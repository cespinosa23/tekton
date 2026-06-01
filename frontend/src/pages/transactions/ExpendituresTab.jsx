import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Plus, Search, Eye, Pencil, Trash2, Archive, X, Receipt } from 'lucide-react'
import { fmt } from './constants'
import ProjectCombobox from '../../components/ProjectCombobox'
import {
  getTransactions, getProjects, getSettings,
  createTransaction, updateTransaction, archiveTransaction
} from '../../api/transactions'

const emptyForm = {
  transaction_type: 'General Expenditure',
  transaction_date: format(new Date(), 'yyyy-MM-dd'),
  project_id: '',
  project_name: '',
  is_office_expense: false,
  amount: 0,
  expenditure_category: '',
  reference_number: '',
  description: '',
  remarks: '',
}

export default function ExpendituresTab() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [viewTx, setViewTx] = useState(null)
  const [deleteTx, setDeleteTx] = useState(null)
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState(emptyForm)

  const { data: allTransactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: getTransactions })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: settings = [] } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const transactions = allTransactions.filter(t => t.transaction_type === 'General Expenditure')
  const getOptions = (cat) => settings.filter(s => s.category === cat && s.is_active)

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); closeForm(); toast.success('Expenditure recorded') },
    onError: () => toast.error('Failed to record expenditure'),
  })

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); closeForm(); toast.success('Expenditure updated') },
    onError: () => toast.error('Failed to update expenditure'),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveTransaction,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); setDeleteTx(null); toast.success('Expenditure archived') },
    onError: () => toast.error('Failed to archive expenditure'),
  })

  const closeForm = () => { setFormOpen(false); setEditingTx(null); setFormData(emptyForm) }

  const handleEdit = (tx) => {
    setEditingTx(tx)
    setFormData({
      transaction_type: 'General Expenditure',
      transaction_date: tx.transaction_date || format(new Date(), 'yyyy-MM-dd'),
      project_id: tx.project_id || '',
      project_name: tx.project_name || '',
      is_office_expense: tx.is_office_expense || false,
      amount: tx.amount || 0,
      expenditure_category: tx.expenditure_category || '',
      reference_number: tx.reference_number || '',
      description: tx.description || '',
      remarks: tx.remarks || '',
    })
    setFormOpen(true)
  }

  const handleSave = () => {
    const data = { ...formData }
    if (data.is_office_expense) { data.project_id = null; data.project_name = 'Office Expense' }
    if (editingTx) {
      updateMutation.mutate({ id: editingTx.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const filtered = transactions.filter(tx =>
    tx.description?.toLowerCase().includes(search.toLowerCase()) ||
    tx.project_name?.toLowerCase().includes(search.toLowerCase()) ||
    tx.expenditure_category?.toLowerCase().includes(search.toLowerCase())
  )

  const set = (field) => (e) => setFormData(p => ({ ...p, [field]: e.target.value }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            placeholder="Search expenditures..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => { setEditingTx(null); setFormData(emptyForm); setFormOpen(true) }}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ml-3">
          <Plus size={15} /> New Expenditure
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['#', 'Date', 'Project / Office', 'Category', 'Description', 'Amount', 'Actions'].map(h => (
                <th key={h} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${['Amount', 'Actions'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No expenditures found</td></tr>
            ) : filtered.map(tx => (
              <tr key={tx.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 text-xs font-mono">{tx.id}</td>
                <td className="px-4 py-3 text-gray-600">{tx.transaction_date ? format(new Date(tx.transaction_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}</td>
                <td className="px-4 py-3 text-gray-600">{tx.is_office_expense ? <span className="italic text-gray-400">Office</span> : tx.project_name || '-'}</td>
                <td className="px-4 py-3">
                  {tx.expenditure_category ? <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs">{tx.expenditure_category}</span> : '-'}
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{tx.description || '-'}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">-{fmt(tx.amount)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => setViewTx(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Eye size={15} /></button>
                    <button onClick={() => handleEdit(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={15} /></button>
                    <button onClick={() => setDeleteTx(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-amber-600" />
                <h2 className="text-lg font-semibold text-gray-900">{editingTx ? 'Edit Expenditure' : 'New Expenditure'}</h2>
              </div>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={formData.transaction_date} onChange={set('transaction_date')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (₱) *</label>
                  <input type="number" value={formData.amount}
                    onChange={e => setFormData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input type="checkbox" id="exp_office" checked={formData.is_office_expense}
                    onChange={e => setFormData(p => ({ ...p, is_office_expense: e.target.checked, project_id: '', project_name: '' }))}
                    className="w-4 h-4 rounded" />
                  <label htmlFor="exp_office" className="text-sm text-gray-700 cursor-pointer">Office / Operational Expense</label>
                </div>
                {!formData.is_office_expense && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Project</label>
                    <ProjectCombobox value={formData.project_id}
                      onValueChange={id => { const p = projects.find(x => x.id === id); setFormData(prev => ({ ...prev, project_id: id, project_name: p?.project_name || '' })) }}
                      projects={projects} />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Expenditure Category</label>
                <select value={formData.expenditure_category} onChange={set('expenditure_category')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                  <option value="">Select category...</option>
                  {getOptions('Expenditure Category').map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Reference Number</label>
                <input value={formData.reference_number} onChange={set('reference_number')} placeholder="OR#, Invoice#, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formData.description} rows={2} onChange={set('description')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <textarea value={formData.remarks} rows={2} onChange={set('remarks')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={closeForm} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={!formData.transaction_date || formData.amount <= 0}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {editingTx ? 'Update' : 'Record'} Expenditure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Dialog */}
      {viewTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Expenditure Details</h2>
              <button onClick={() => setViewTx(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400 mb-0.5">Date</p><p className="font-medium">{viewTx.transaction_date ? format(new Date(viewTx.transaction_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Amount</p><p className="text-xl font-bold text-red-600">-{fmt(viewTx.amount)}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Project</p><p className="font-medium">{viewTx.is_office_expense ? 'Office Expense' : viewTx.project_name || '-'}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Category</p><p className="font-medium">{viewTx.expenditure_category || '-'}</p></div>
                {viewTx.reference_number && <div><p className="text-xs text-gray-400 mb-0.5">Reference #</p><p className="font-medium">{viewTx.reference_number}</p></div>}
              </div>
              {viewTx.description && <div><p className="text-xs text-gray-400 mb-0.5">Description</p><p>{viewTx.description}</p></div>}
              {viewTx.remarks && <div><p className="text-xs text-gray-400 mb-0.5">Remarks</p><p>{viewTx.remarks}</p></div>}
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation */}
      {deleteTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive Expenditure</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to archive this expenditure record?</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTx(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={() => archiveMutation.mutate(deleteTx.id)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">
                <Archive size={15} /> Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}