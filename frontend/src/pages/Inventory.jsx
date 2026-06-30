import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import Layout from '../components/Layout'
import { getMaterials, getTransactions, getInventoryRecords, getMaterialTypes } from '../api/inventory'
import { Search, Package, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { useSortable } from '../hooks/useSortable'
import { SortableHeader } from '../components/SortableHeader'

export default function Inventory() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: getMaterials })
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: getTransactions })
  const { data: inventoryRecords = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventoryRecords,
    refetchOnWindowFocus: true,
  })
  const { data: materialTypes = [] } = useQuery({ queryKey: ['materialTypes'], queryFn: getMaterialTypes })

  const calculateInventory = () => {
    const inventory = {}
    const startOfMonth = new Date(selectedMonth + '-01')
    const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0)

    // Initialize from inventory records (per material+brand)
    inventoryRecords.forEach(rec => {
      const mat = materials.find(m => m.id === rec.material_id)
      const key = `${rec.material_id}_${rec.brand || ''}`
      inventory[key] = {
        material_id: rec.material_id,
        brand: rec.brand || '',
        material_name: mat?.rating_size || mat?.name || 'Unknown',
        material_type: mat?.material_type || '',
        unit: mat?.unit || '',
        latest_unit_cost: parseFloat(rec.latest_unit_cost) || 0,
        starting_quantity: 0,
        quantity_in: 0,
        quantity_out: 0,
        balance: 0,
        total_value: 0,
      }
    })

    // Also add materials that have no inventory record yet
    materials.forEach(mat => {
      const key = `${mat.id}_`
      if (!Object.keys(inventory).some(k => k.startsWith(`${mat.id}_`))) {
        inventory[key] = {
          material_id: mat.id,
          brand: '',
          material_name: mat.rating_size || mat.name || '',
          material_type: mat.material_type || '',
          unit: mat.unit || '',
          latest_unit_cost: 0,
          starting_quantity: 0,
          quantity_in: 0,
          quantity_out: 0,
          balance: 0,
          total_value: 0,
        }
      }
    })

    // Process transactions per material+brand
    transactions.forEach(tx => {
      if (!tx.materials || !tx.transaction_date) return
      const txDate = new Date(tx.transaction_date + 'T00:00:00')

      tx.materials.forEach(mat => {
        if (!mat.material_id) return
        const brand = mat.brand || ''
        const key = `${mat.material_id}_${brand}`

        if (!inventory[key]) {
          const material = materials.find(m => m.id === mat.material_id)
          inventory[key] = {
            material_id: mat.material_id,
            brand,
            material_name: material?.rating_size || mat.material_name || 'Unknown',
            material_type: material?.material_type || '',
            unit: mat.unit || material?.unit || '',
            latest_unit_cost: 0,
            starting_quantity: 0,
            quantity_in: 0,
            quantity_out: 0,
            balance: 0,
            total_value: 0,
          }
        }

        const qty = parseFloat(mat.quantity) || 0

        // Only office procurement affects stock
        const affectsStock =
          tx.transaction_type !== 'Materials Procurement' ||
          tx.is_office_expense === true

        if (!affectsStock) return

        if (txDate < startOfMonth) {
          if (['Materials Procurement', 'Incoming Materials'].includes(tx.transaction_type)) {
            inventory[key].starting_quantity += qty
          } else if (tx.transaction_type === 'Outgoing Materials') {
            inventory[key].starting_quantity -= qty
          }
        } else if (txDate >= startOfMonth && txDate <= endOfMonth) {
          if (['Materials Procurement', 'Incoming Materials'].includes(tx.transaction_type)) {
            inventory[key].quantity_in += qty
          } else if (tx.transaction_type === 'Outgoing Materials') {
            inventory[key].quantity_out += qty
          }
        }
      })
    })

    // Calculate balances and total value
    Object.values(inventory).forEach(item => {
      item.balance = item.starting_quantity + item.quantity_in - item.quantity_out
      item.total_value = item.balance * item.latest_unit_cost
    })

    // Filter out rows with no activity and no balance
    return Object.values(inventory).filter(item =>
      item.balance !== 0 ||
      item.quantity_in !== 0 ||
      item.quantity_out !== 0 ||
      item.starting_quantity !== 0
    )
  }

  const inventoryData = calculateInventory()

  const filtered = inventoryData.filter(item => {
    const matchesSearch =
      item.material_name?.toLowerCase().includes(search.toLowerCase()) ||
      item.brand?.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || item.material_type === typeFilter
    return matchesSearch && matchesType
  })

  const { sortKey, sortDir, toggle, sorted } = useSortable(filtered, 'material_name')

  const totalItems = filtered.reduce((sum, i) => sum + i.balance, 0)
  const totalValue = filtered.reduce((sum, i) => sum + i.total_value, 0)
  const lowStockItems = filtered.filter(i => i.balance <= 0).length

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-500 mt-1">Auto-generated from transactions — per material and brand</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Items in Stock</p>
                <p className="text-2xl font-bold text-gray-900">{totalItems.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-lg">
                <Package size={18} className="text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Total Inventory Value</p>
                <p className="text-2xl font-bold text-emerald-600">₱{totalValue.toLocaleString()}</p>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg">
                <TrendingUp size={18} className="text-emerald-600" />
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-1">Low / Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{lowStockItems}</p>
              </div>
              <div className="p-2.5 bg-red-50 rounded-lg">
                <AlertTriangle size={18} className="text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Search by material or brand..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <input type="month" value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-300 rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <option value="all">All Types</option>
            {materialTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortableHeader label="Material / Specs" field="material_name" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Brand" field="brand" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Type" field="material_type" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Starting</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">In</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Out</th>
                <SortableHeader label="Balance" field="balance" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" align="center" />
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Unit Cost</th>
                <SortableHeader label="Total Value" field="total_value" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-gray-400">No inventory data available</td></tr>
              ) : sorted.map(item => (
                <tr key={`${item.material_id}_${item.brand}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.material_name}</p>
                    <p className="text-xs text-gray-400">{item.unit}</p>
                  </td>
                  <td className="px-4 py-3">
                    {item.brand
                      ? <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">{item.brand}</span>
                      : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {item.material_type
                      ? <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{item.material_type}</span>
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{item.starting_quantity}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-emerald-600 text-xs font-medium">
                      <TrendingUp size={12} />{item.quantity_in}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-red-500 text-xs font-medium">
                      <TrendingDown size={12} />{item.quantity_out}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${item.balance <= 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                      {item.balance}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ₱{parseFloat(item.latest_unit_cost).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    ₱{item.total_value.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  )
}