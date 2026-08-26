import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import {
  getMaterials, getMaterialTypes, getSettings, createMaterial, updateMaterial, archiveMaterial,
  downloadMaterialsTemplate, importMaterials,
} from '../api/materials'
import { Plus, Search, Pencil, Trash2, Archive, X, Download, Upload } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { useSortable } from '../hooks/useSortable'
import { SortableHeader } from '../components/SortableHeader'
import { useElementHeight } from '../hooks/useElementHeight'

const emptyForm = { rating_size: '', material_type: '', unit: '', description: '', min_stock: '', max_stock: '' }

export default function Materials() {
  const { canWrite, canSeeNav } = usePermissions()
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState(null)
  const [deleteMaterial, setDeleteMaterial] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [formData, setFormData] = useState(emptyForm)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

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

  const importMutation = useMutation({
    mutationFn: importMaterials,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] })
      setImportResult(result)
      setImportFile(null)
      if (result.created > 0) toast.success(`${result.created} material${result.created === 1 ? '' : 's'} imported`)
      else toast.error('No materials were imported — see details below')
    },
    onError: () => toast.error('Import failed — check the file and try again'),
  })

  const closeImport = () => { setImportOpen(false); setImportFile(null); setImportResult(null) }

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      await downloadMaterialsTemplate()
    } catch {
      toast.error('Failed to download template')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const getOptions = (category) => settings.filter(s => s.category === category && s.is_active)

  const handleEdit = (mat) => {
    setEditingMaterial(mat)
    setFormData({
      rating_size: mat.rating_size || '',
      material_type: mat.material_type || '',
      unit: mat.unit || '',
      description: mat.description || '',
      min_stock: mat.min_stock ?? '',
      max_stock: mat.max_stock ?? '',
    })
    setFormOpen(true)
  }

  const handleSave = () => {
    const isDuplicate = materials.some(m =>
      m.rating_size?.toLowerCase() === formData.rating_size?.toLowerCase() &&
      m.material_type === formData.material_type &&
      (!editingMaterial || m.id !== editingMaterial.id)
    )
    if (isDuplicate) { toast.error('A material with this name and type already exists.'); return }
    const payload = {
      ...formData,
      min_stock: formData.min_stock === '' ? 0 : parseInt(formData.min_stock, 10),
      max_stock: formData.max_stock === '' ? null : parseInt(formData.max_stock, 10),
    }
    if (editingMaterial) {
      updateMutation.mutate({ id: editingMaterial.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const filtered = materials.filter(m => {
    const matchesSearch = m.rating_size?.toLowerCase().includes(search.toLowerCase()) ||
      m.description?.toLowerCase().includes(search.toLowerCase())
    const matchesType = typeFilter === 'all' || m.material_type === typeFilter
    return matchesSearch && matchesType
  })
  const { sortKey, sortDir, toggle, sorted } = useSortable(filtered, 'rating_size')
  const [toolbarRef, toolbarHeight] = useElementHeight()

  if (!canSeeNav('/materials')) {
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
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Materials Master List</h1>
              <p className="text-sm text-gray-500 mt-1">Manage materials reference for the system</p>
            </div>
            {canWrite('materials') && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Download size={16} /> {downloadingTemplate ? 'Downloading…' : 'Template'}
                </button>
                <button
                  onClick={() => { setImportResult(null); setImportFile(null); setImportOpen(true) }}
                  className="flex items-center gap-2 border border-gray-300 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  <Upload size={16} /> Import
                </button>
                <button
                  onClick={() => { setEditingMaterial(null); setFormData(emptyForm); setFormOpen(true) }}
                  className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  <Plus size={16} /> Add Material
                </button>
              </div>
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
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 sticky z-10" style={{ top: toolbarHeight }}>
              <tr>
                <SortableHeader label="Material / Specs" field="rating_size" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Type" field="material_type" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <SortableHeader label="Unit" field="unit" sortKey={sortKey} sortDir={sortDir} onSort={toggle} className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide" />
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Min / Max Stock</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No materials found</td></tr>
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
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs text-gray-700 font-medium">{mat.min_stock ?? 0}</span>
                    <span className="text-xs text-gray-400 mx-1">/</span>
                    <span className="text-xs text-gray-500">{mat.max_stock ?? '—'}</span>
                  </td>
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Min Stock *</label>
                    <input type="number" min="0" value={formData.min_stock}
                      onChange={e => setFormData(p => ({ ...p, min_stock: e.target.value }))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    <p className="text-xs text-gray-400 mt-1">Out of stock threshold</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Max Stock</label>
                    <input type="number" min="0" value={formData.max_stock}
                      onChange={e => setFormData(p => ({ ...p, max_stock: e.target.value }))}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    <p className="text-xs text-gray-400 mt-1">Maximum capacity</p>
                  </div>
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
                <button onClick={handleSave} disabled={!formData.rating_size || !formData.unit || formData.min_stock === ''}
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

        {/* Import Modal */}
        {importOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Import Materials</h2>
                <button onClick={closeImport} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <p className="text-sm text-gray-500">
                  Upload a filled-in copy of the import template. Rows with an unrecognized Material Type,
                  a duplicate Material Type + Material/Specs, or a missing required field are skipped —
                  everything else gets imported.
                </p>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Excel file (.xlsx)</label>
                  <input type="file" accept=".xlsx"
                    onChange={e => { setImportFile(e.target.files[0] || null); setImportResult(null) }}
                    className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:hover:bg-gray-50" />
                </div>

                {importResult && (
                  <div className="border border-gray-200 rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium text-gray-900">
                      {importResult.created} material{importResult.created === 1 ? '' : 's'} imported
                      {importResult.skipped.length > 0 && `, ${importResult.skipped.length} skipped`}
                    </p>
                    {importResult.skipped.length > 0 && (
                      <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded">
                        {importResult.skipped.map((s, i) => (
                          <div key={i} className="px-3 py-2 text-xs">
                            <span className="text-gray-400">Row {s.row}:</span>{' '}
                            <span className="text-gray-700 font-medium">{s.material_type || '—'} / {s.rating_size || '—'}</span>{' '}
                            <span className="text-amber-600">— {s.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t">
                <button onClick={closeImport} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                <button onClick={() => importMutation.mutate(importFile)}
                  disabled={!importFile || importMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  <Upload size={15} /> {importMutation.isPending ? 'Importing…' : 'Upload & Import'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}