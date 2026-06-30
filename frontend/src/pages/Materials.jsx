import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import { getMaterials, getMaterialTypes, getSettings, createMaterial, updateMaterial, archiveMaterial } from '../api/materials'
import { Plus, Search, Pencil, Trash2, Archive, X } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { useSortable } from '../hooks/useSortable'
import { SortableHeader } from '../components/SortableHeader'

const emptyForm = { rating_size: '', material_type: '', unit: '', description: '' }

export default function Materials() {
  const { canWrite } = usePermissions()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [deleteMaterial, setDeleteMaterial] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [formData, setFormData] = useState(emptyForm)

  const { data: materials = [], isLoading } = useQuery({ queryKey: ['materials'], queryFn: getMaterials })
  const { data: materialTypes = [] } = useQuery({ queryKey: ['materialTypes'], queryFn: getMaterialTypes })
  const { data: settings = [] } = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const createMutation = useMutation({
    mutationFn: createMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      closeForm()
      toast.success('Material added')
    },
    onError: () => toast.error('Failed to add material'),
  })

  const updateMutation = useMutation({
    mutationFn: updateMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      closeForm()
      toast.success('Material updated')
    },
    onError: () => toast.error('Failed to update material'),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveMaterial,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      setDeleteMaterial(null)
      toast.success('Material archived')
    },
    onError: () => toast.error('Failed to archive material'),
  })

  const closeForm = () => { setFormOpen(false); setEditingMaterial(null); setFormData(emptyForm) }

  const getOptions = (category) => settings.filter(s => s.category === category && s.is_active)

  const handleEdit = (mat) => {
    setEditingMaterial(mat)
    setFormData({
      rating_size: mat.rating_size || '',
      material_type: mat.material_type || '',
      unit: mat.unit || '',
      description: mat.description || '',
    })
    setFormOpen(true)
  }

  const handleSave = () => {
    const isDuplicate = materials.some(m =>
      m.rating_size?.toLowerCase() === formData.rating_size?.toLowerCase() &&
      (!editingMaterial || m.id !== editingMaterial.id)
    )
    if (isDuplicate) { toast.error('A material with this name already exists.'); return }
    if (editingMaterial) {
      updateMutation.mutate({ id: editingMaterial.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const filtered = materials.filter(m => {
    const matchesSearch = m.rating_size?.toLowerCase().includes(search.toLowerCase()) ||
      m.description?.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || m.material_type === typeFilter
    return matchesSearch && matchesType
  })
  const { sortKey, sortDir, toggle, sorted } = useSortable(filtered, 'rating_size')

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Materials Master List</h1>
            <p className="text-sm text-gray-500 mt-1">Manage materials reference for the system</p>
          </div>
          {canWrite('materials') && (
            <button
              onClick={() => { setEditingMaterial(null); setFormData(emptyForm); setFormOpen(true) }}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              <Plus size={16} /> Add Material
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              placeholder="Search materials..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
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
                <SortableHeader label="Material / Specs" field="rating_size" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Type" field="material_type" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Unit" field="unit" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">No materials found</td></tr>
              ) : sorted.map(mat => (
                <tr key={mat.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{mat.rating_size}</p>
                    {mat.description && (
                      <p className="text-xs text-gray-400 italic truncate max-w-xs">{mat.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {mat.material_type ? (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{mat.material_type}</span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{mat.unit || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canWrite('materials') && (
                        <button onClick={() => handleEdit(mat)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                          <Pencil size={15} />
                        </button>
                      )}
                      {canWrite('materials') && (
                        <button onClick={() => setDeleteMaterial(mat)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500">
                          <Trash2 size={15} />
                        </button>
                      )}
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">{editingMaterial ? 'Edit Material' : 'Add Material'}</h2>
                <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Material / Specs *</label>
                  <input value={formData.rating_size} onChange={e => setFormData(p => ({ ...p, rating_size: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Material Type</label>
                  <select value={formData.material_type} onChange={e => setFormData(p => ({ ...p, material_type: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                    <option value="">Select type...</option>
                    {materialTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit of Quantity *</label>
                  <select value={formData.unit} onChange={e => setFormData(p => ({ ...p, unit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                    <option value="">Select unit...</option>
                    {getOptions('Material Unit').map(o => <option key={o.id} value={o.value}>{o.value}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={formData.description} rows={3}
                    onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t">
                <button onClick={closeForm} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={!formData.rating_size || !formData.unit}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  {editingMaterial ? 'Update' : 'Add'} Material
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archive Confirmation */}
        {deleteMaterial && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive Material</h3>
              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to archive <strong>"{deleteMaterial.rating_size}"</strong>?
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setDeleteMaterial(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={() => archiveMutation.mutate(deleteMaterial.id)}
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