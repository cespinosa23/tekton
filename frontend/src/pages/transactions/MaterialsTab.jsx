import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Plus, Search, Eye, Pencil, Trash2, Archive, X, TrendingUp, TrendingDown } from 'lucide-react'
import { useSortable } from '../../hooks/useSortable'
import { SortableHeader } from '../../components/SortableHeader'
import { TYPE_COLORS, TYPE_ICONS, MATERIAL_DIRECTIONS, fmt } from './constants'
import ProjectCombobox from '../../components/ProjectCombobox'
import MaterialCombobox from '../../components/MaterialCombobox'
import SupplierCombobox from '../../components/SupplierCombobox'
import {
  getTransactions, getProjects, getMaterials, getSuppliers,
  getInventory, getMaterialTypes, createTransaction, updateTransaction, archiveTransaction
} from '../../api/transactions'

const MATERIAL_TX_TYPES = ['Outgoing Materials', 'Incoming Materials', 'Materials Procurement', 'Adjustment']

const emptyForm = {
  transaction_type: '',
  transaction_date: format(new Date(), 'yyyy-MM-dd'),
  project_id: '',
  project_name: '',
  is_office_expense: true, // always true for adjustment
  supplier: '',
  materials: [],
  description: '',
  remarks: '',
  amount: 0,
  adjustment_direction: 'add', // 'add' or 'deduct'
}

export default function MaterialsTab() {
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingTx, setEditingTx] = useState(null)
  const [viewTx, setViewTx] = useState(null)
  const [deleteTx, setDeleteTx] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [formData, setFormData] = useState(emptyForm)

  const { data: allTransactions = [], isLoading } = useQuery({ queryKey: ['transactions'], queryFn: getTransactions })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: getMaterials })
  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers })
  const { data: inventoryRecords = [], refetch: refetchInventory } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory,
    refetchOnWindowFocus: true,
  })
  const { data: materialTypes = [] } = useQuery({ queryKey: ['materialTypes'], queryFn: getMaterialTypes })

  const transactions = allTransactions.filter(t => MATERIAL_TX_TYPES.includes(t.transaction_type))

  // Get stock per material + brand from inventory table
  const getCurrentStock = (materialId, brand = '') => {
    const inv = inventoryRecords.find(r =>
      r.material_id === materialId &&
      (r.brand || '') === (brand || '')
    )
    return parseFloat(inv?.quantity || 0)
  }

  // Get latest unit cost per material + brand from inventory table
  const getLatestUnitCost = (materialId, brand = '') => {
    const inv = inventoryRecords.find(r =>
      r.material_id === materialId &&
      (r.brand || '') === (brand || '')
    )
    return parseFloat(inv?.latest_unit_cost || 0)
  }

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      closeForm()
      toast.success('Materials transaction recorded')
    },
    onError: () => toast.error('Failed to record transaction'),
  })

  const updateMutation = useMutation({
    mutationFn: updateTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      closeForm()
      toast.success('Transaction updated')
    },
    onError: () => toast.error('Failed to update transaction'),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      setDeleteTx(null)
      toast.success('Transaction archived')
    },
    onError: () => toast.error('Failed to archive transaction'),
  })

  const closeForm = () => { setFormOpen(false); setEditingTx(null); setFormData(emptyForm) }

  const handleEdit = (tx) => {
    setEditingTx(tx)
    setFormData({
      transaction_type: tx.transaction_type || '',
      transaction_date: tx.transaction_date || format(new Date(), 'yyyy-MM-dd'),
      project_id: tx.project_id || '',
      project_name: tx.project_name || '',
      is_office_expense: tx.is_office_expense || false,
      supplier: tx.supplier || '',
      materials: tx.materials || [],
      description: tx.description || '',
      remarks: tx.remarks || '',
      amount: tx.amount || 0,
      adjustment_direction: tx.adjustment_direction || 'add',
    })
    setFormOpen(true)
  }

  const handleSave = () => {
    const data = { ...formData }
    if (data.transaction_type === 'Adjustment') {
      data.is_office_expense = true
      data.project_id = null
      data.project_name = 'Adjustment'
    } else if (data.is_office_expense) {
      data.project_id = null
      data.project_name = 'Office Expense'
    }
    data.amount = data.materials.reduce((s, m) => s + (m.total_cost || 0), 0)
    if (editingTx) {
      updateMutation.mutate({ id: editingTx.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const addMaterialLine = () => {
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, {
        material_type: '', material_id: '', material_name: '',
        brand: '', quantity: 1, unit: '', unit_cost: 0, total_cost: 0, use_fifo: false
      }]
    }))
  }

  const updateMaterialLine = (index, field, value) => {
    setFormData(prev => {
      const lines = [...prev.materials]
      lines[index] = { ...lines[index], [field]: value }

      if (field === 'material_type') {
        lines[index].material_id = ''
        lines[index].material_name = ''
        lines[index].brand = ''
        lines[index].unit = ''
        lines[index].unit_cost = 0
        lines[index].use_fifo = false
      }

      if (field === 'material_id') {
        const mat = materials.find(m => m.id === value)
        if (mat) {
          lines[index].material_name = mat.rating_size
          lines[index].unit = mat.unit
          lines[index].brand = ''
          lines[index].unit_cost = 0
          lines[index].use_fifo = false
        }
      }

      // Auto-populate unit cost when brand is selected (not for Procurement)
      if (field === 'brand' && value) {
        if (['Outgoing Materials', 'Incoming Materials'].includes(formData.transaction_type)) {
          const cost = getLatestUnitCost(lines[index].material_id, value)
          if (cost > 0) {
            lines[index].unit_cost = cost
            lines[index].use_fifo = true
          } else {
            lines[index].unit_cost = 0
            lines[index].use_fifo = false
          }
        } else {
          // Procurement — clear unit cost for manual entry
          lines[index].unit_cost = 0
          lines[index].use_fifo = false
        }
      }

      // FIFO checkbox manually checked — re-apply inventory price
      if (field === 'use_fifo' && value === true) {
        const cost = getLatestUnitCost(lines[index].material_id, lines[index].brand)
        if (cost > 0) {
          lines[index].unit_cost = cost
        } else {
          toast.error('No unit cost found in inventory for this material and brand.')
          lines[index].use_fifo = false
        }
      }

      // FIFO unchecked — allow manual entry
      if (field === 'use_fifo' && value === false) {
        lines[index].use_fifo = false
      }

      lines[index].total_cost = (lines[index].quantity || 0) * (lines[index].unit_cost || 0)
      return { ...prev, materials: lines }
    })
  }

  const removeMaterialLine = (index) => {
    setFormData(prev => ({ ...prev, materials: prev.materials.filter((_, i) => i !== index) }))
  }

  const getBrandsForMaterial = (materialId) => {
    const mat = materials.find(m => m.id === materialId)
    if (!mat?.material_type) return []
    const mt = materialTypes.find(t => t.name === mat.material_type)
    return mt?.brands || []
  }

  const getMaterialsByType = (type) => !type ? materials : materials.filter(m => m.material_type === type)

  const showFIFO = ['Outgoing Materials', 'Incoming Materials'].includes(formData.transaction_type)
  const needsSupplier = formData.transaction_type === 'Materials Procurement'

  const filtered = transactions.filter(tx => {
    const matchSearch =
      tx.description?.toLowerCase().includes(search.toLowerCase()) ||
      tx.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      tx.supplier?.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === 'all' || tx.transaction_type === typeFilter
    return matchSearch && matchType
  })

  const { sortKey, sortDir, toggle, sorted } = useSortable(filtered, 'transaction_date', 'desc')

  const totalMaterialsAmount = formData.materials.reduce((s, m) => s + (m.total_cost || 0), 0)

  const set = (field) => (e) => setFormData(p => ({ ...p, [field]: e.target.value }))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-3 flex-1">
          <div className="relative max-w-sm flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Search materials transactions..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="all">All Types</option>
            {MATERIAL_TX_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={() => { setEditingTx(null); setFormData(emptyForm); setFormOpen(true) }}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 ml-3">
          <Plus size={15} /> New
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">#</th>
              <SortableHeader label="Date" field="transaction_date" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
              <SortableHeader label="Type" field="transaction_type" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
              <SortableHeader label="Project / Office" field="project_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
              <SortableHeader label="Supplier" field="supplier" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Description</th>
              <SortableHeader label="Amount" field="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" align="right" />
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No material transactions found</td></tr>
            ) : sorted.map(tx => {
              const Icon = TYPE_ICONS[tx.transaction_type]
              return (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 text-xs font-mono">{tx.id}</td>
                  <td className="px-4 py-3 text-gray-600">{tx.transaction_date ? format(new Date(tx.transaction_date + 'T00:00:00'), 'MMM d, yyyy') : '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[tx.transaction_type] || ''}`}>
                      {Icon && <Icon size={11} />}{tx.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{tx.is_office_expense ? <span className="italic text-gray-400">Office</span> : tx.project_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{tx.supplier || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{tx.description || '-'}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${tx.transaction_type === 'Incoming Materials' ? 'text-blue-600' : 'text-red-600'}`}>
                    {tx.transaction_type === 'Incoming Materials' ? '+' : '-'}{fmt(tx.amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setViewTx(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Eye size={15} /></button>
                      <button onClick={() => handleEdit(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Pencil size={15} /></button>
                      <button onClick={() => setDeleteTx(tx)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">{editingTx ? 'Edit Materials Transaction' : 'New Materials Transaction'}</h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-5">

              {/* Direction Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Transaction Type *</label>
                <div className="grid grid-cols-4 gap-3">
                  {MATERIAL_DIRECTIONS.map(dir => {
                    const Icon = dir.icon
                    const isSelected = formData.transaction_type === dir.value
                    return (
                      <button key={dir.value} type="button"
                        onClick={() => setFormData(p => ({ ...p, transaction_type: dir.value, materials: [] }))}
                        className={`flex flex-col items-center gap-2 p-4 border-2 rounded-lg transition-all ${isSelected ? dir.activeColor : dir.color + ' hover:opacity-80'}`}>
                        <Icon size={22} />
                        <span className="text-sm font-semibold">{dir.label}</span>
                        <span className="text-xs text-center opacity-75">{dir.description}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Adjustment Direction */}
              {formData.transaction_type === 'Adjustment' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Adjustment Direction *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button"
                      onClick={() => setFormData(p => ({ ...p, adjustment_direction: 'add' }))}
                      className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg transition-all ${formData.adjustment_direction === 'add'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-600 hover:opacity-80'
                        }`}>
                      <TrendingUp size={18} />
                      <span className="text-sm font-semibold">+ Add to Stock</span>
                    </button>
                    <button type="button"
                      onClick={() => setFormData(p => ({ ...p, adjustment_direction: 'deduct' }))}
                      className={`flex items-center justify-center gap-2 p-3 border-2 rounded-lg transition-all ${formData.adjustment_direction === 'deduct'
                          ? 'border-red-500 bg-red-50 text-red-700 ring-2 ring-red-200'
                          : 'border-red-300 bg-red-50 text-red-600 hover:opacity-80'
                        }`}>
                      <TrendingDown size={18} />
                      <span className="text-sm font-semibold">- Deduct from Stock</span>
                    </button>
                  </div>
                </div>
              )}

              {formData.transaction_type && (
                <>
                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                    <input type="date" value={formData.transaction_date} onChange={set('transaction_date')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  </div>

                  {/* Project */}
                  {formData.transaction_type !== 'Adjustment' && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <input type="checkbox" id="mat_office" checked={formData.is_office_expense}
                          onChange={e => setFormData(p => ({ ...p, is_office_expense: e.target.checked, project_id: '', project_name: '' }))}
                          className="w-4 h-4 rounded" />
                        <label htmlFor="mat_office" className="text-sm text-gray-700 cursor-pointer">Office / Operational Expense</label>
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
                  )}

                  {/* Supplier (Procurement only) */}
                  {needsSupplier && formData.transaction_type !== 'Adjustment' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
                      <SupplierCombobox value={formData.supplier}
                        onValueChange={val => setFormData(p => ({ ...p, supplier: val }))}
                        suppliers={suppliers} />
                    </div>
                  )}

                  {/* Materials Lines */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs font-medium text-gray-700">Materials *</label>
                      <button type="button" onClick={addMaterialLine}
                        className="flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-xs hover:bg-gray-50">
                        <Plus size={13} /> Add Line
                      </button>
                    </div>
                    <div className="space-y-3">
                      {formData.materials.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
                          No materials added. Click "Add Line" to add materials.
                        </p>
                      ) : formData.materials.map((line, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                          {/* Row 1: Type, Material, Delete */}
                          <div className="grid grid-cols-12 gap-3 mb-3">
                            <div className="col-span-4">
                              <label className="block text-xs text-gray-500 mb-1">Material Type</label>
                              <select value={line.material_type}
                                onChange={e => updateMaterialLine(idx, 'material_type', e.target.value)}
                                className="w-full h-9 px-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400">
                                <option value="">All Types</option>
                                {materialTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                              </select>
                            </div>
                            <div className="col-span-7">
                              <label className="block text-xs text-gray-500 mb-1">Material</label>
                              <MaterialCombobox value={line.material_id}
                                onValueChange={val => updateMaterialLine(idx, 'material_id', val)}
                                materials={getMaterialsByType(line.material_type)} />
                            </div>
                            <div className="col-span-1 flex items-end">
                              <button type="button" onClick={() => removeMaterialLine(idx)}
                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* Row 2: Brand */}
                          <div className="mb-3">
                            <label className="block text-xs text-gray-500 mb-1">Brand</label>
                            {getBrandsForMaterial(line.material_id).length > 0 ? (
                              <select value={line.brand}
                                onChange={e => updateMaterialLine(idx, 'brand', e.target.value)}
                                className="w-full h-9 px-3 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-gray-400">
                                <option value="">Select brand...</option>
                                {getBrandsForMaterial(line.material_id).map(b => (
                                  <option key={b.id} value={b.brand_name}>{b.brand_name}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="h-9 flex items-center px-3 bg-white border border-gray-200 rounded-md text-sm text-gray-400">
                                {line.material_id ? 'No brands set for this type' : 'Select a material first'}
                              </div>
                            )}
                          </div>

                          {/* Stock Warning (Outgoing only) */}
                          {line.material_id && formData.transaction_type === 'Outgoing Materials' && (() => {
                            const stock = getCurrentStock(line.material_id, line.brand)
                            const qty = line.quantity || 0
                            if (qty > stock) {
                              return (
                                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-md mb-3">
                                  <span className="text-amber-600 text-xs">⚠️</span>
                                  <span className="text-xs text-amber-700">
                                    Requested qty <strong>{qty}</strong> exceeds current stock of <strong>{stock} {line.unit}</strong>
                                    {line.brand && ` for ${line.brand}`}. You can still proceed but inventory will go negative.
                                  </span>
                                </div>
                              )
                            }
                            return null
                          })()}

                          {/* Row 3: Qty, Unit, Cost */}
                          <div className="grid grid-cols-12 gap-3">
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">Qty</label>
                              <input type="text" value={line.quantity === 0 ? '' : Number(line.quantity).toLocaleString('en-US')}
                                placeholder="0"
                                onChange={e => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  if (!/^\d*\.?\d*$/.test(raw)) return;
                                  if (/^0\d/.test(raw)) return;
                                  updateMaterialLine(idx, 'quantity', raw === '' ? 0 : parseFloat(raw) || 0);
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400" />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs text-gray-500 mb-1">Unit</label>
                              <div className="h-8 flex items-center px-2 bg-white border border-gray-200 rounded text-sm text-gray-600">{line.unit || '-'}</div>
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs text-gray-500 mb-1">
                                Unit Cost
                                {line.use_fifo && <span className="ml-1 text-blue-500 font-normal">(FIFO)</span>}
                              </label>
                              <input type="text" value={line.use_fifo ? Number(line.unit_cost).toLocaleString('en-US') : (line.unit_cost === 0 ? '' : Number(line.unit_cost).toLocaleString('en-US'))}
                                disabled={line.use_fifo}
                                placeholder="0.00"
                                onChange={e => {
                                  const raw = e.target.value.replace(/,/g, '');
                                  if (!/^\d*\.?\d*$/.test(raw)) return;
                                  if (/^0\d/.test(raw)) return;
                                  updateMaterialLine(idx, 'unit_cost', raw === '' ? 0 : parseFloat(raw) || 0);
                                }}
                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed" />
                            </div>
                            <div className="col-span-5">
                              <label className="block text-xs text-gray-500 mb-1">Total Cost</label>
                              <div className="h-8 flex items-center justify-end px-2 bg-amber-50 border border-amber-200 rounded text-sm font-semibold text-amber-900">
                                {fmt(line.total_cost)}
                              </div>
                            </div>
                          </div>

                          {/* FIFO Checkbox */}
                          {showFIFO && (
                            <div className="flex items-center gap-2 mt-2">
                              <input type="checkbox" id={`fifo_${idx}`} checked={line.use_fifo || false}
                                onChange={e => updateMaterialLine(idx, 'use_fifo', e.target.checked)}
                                className="w-3.5 h-3.5 rounded" />
                              <label htmlFor={`fifo_${idx}`} className="text-xs text-gray-600 cursor-pointer">
                                Use inventory price (FIFO){line.brand ? ` — latest ${line.brand} cost` : ''}
                              </label>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Summary Warning */}
                    {formData.transaction_type === 'Outgoing Materials' && formData.materials.some(line => {
                      const stock = getCurrentStock(line.material_id, line.brand)
                      return line.material_id && (line.quantity || 0) > stock
                    }) && (
                        <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg mt-3">
                          <span className="text-amber-500 mt-0.5">⚠️</span>
                          <div>
                            <p className="text-sm font-medium text-amber-800">Stock Warning</p>
                            <p className="text-xs text-amber-700 mt-0.5">
                              One or more materials exceed available stock. Review quantities before saving. This can be updated later if needed.
                            </p>
                          </div>
                        </div>
                      )}

                    {/* Total */}
                    {formData.materials.length > 0 && (
                      <div className="mt-3 flex justify-end">
                        <div className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                          Total: {fmt(totalMaterialsAmount)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description & Remarks */}
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
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button onClick={closeForm} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave}
                disabled={!formData.transaction_type || !formData.transaction_date || formData.materials.length === 0}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {editingTx ? 'Update' : 'Record'} Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Dialog */}
      {viewTx && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Materials Transaction Details</h2>
              <button onClick={() => setViewTx(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[viewTx.transaction_type] || ''}`}>{viewTx.transaction_type}</span>
                <span className="text-gray-500">{viewTx.transaction_date ? format(new Date(viewTx.transaction_date + 'T00:00:00'), 'MMMM d, yyyy') : '-'}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-gray-400 mb-0.5">Project</p><p className="font-medium">{viewTx.is_office_expense ? 'Office Expense' : viewTx.project_name || '-'}</p></div>
                <div><p className="text-xs text-gray-400 mb-0.5">Total Amount</p><p className="text-xl font-bold text-gray-900">{fmt(viewTx.amount)}</p></div>
                {viewTx.supplier && <div><p className="text-xs text-gray-400 mb-0.5">Supplier</p><p className="font-medium">{viewTx.supplier}</p></div>}
              </div>
              {viewTx.materials?.length > 0 && (
                <div>
                  <p className="text-xs text-gray-400 mb-2">Materials</p>
                  <div className="space-y-2">
                    {viewTx.materials.map((mat, idx) => (
                      <div key={idx} className="flex justify-between p-2 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-gray-900">{mat.material_name} {mat.brand && `(${mat.brand})`}</p>
                          <p className="text-xs text-gray-400">{mat.quantity} {mat.unit} × {fmt(mat.unit_cost)}</p>
                        </div>
                        <p className="font-semibold text-gray-900">{fmt(mat.total_cost)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive Transaction</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to archive this materials transaction?</p>
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