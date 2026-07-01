import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import {
  getSettings, createSetting, updateSetting, archiveSetting,
  getCompanies, createCompany, updateCompany, deleteCompany,
  getMaterialTypes, createMaterialType, updateMaterialType,
  archiveMaterialType, addBrandToType, removeBrandFromType,
  getSuppliers, createSupplier, updateSupplier, archiveSupplier,
  resetAllData
} from '../api/settings'
import {
  Plus, Trash2, Pencil, Check, X,
  Users, MapPin, Building2, Tag, Ruler, Package, Truck, AlertTriangle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const CATEGORIES = [
  { key: 'Brand', label: 'Brand', icon: Tag, description: 'Master list of material brands' },
  { key: 'Expenditure Category', label: 'Expenditure Category', icon: Tag, description: 'Categories for general expenditures' },
  { key: 'LGU', label: 'LGU', icon: MapPin, description: 'Local Government Units' },
  { key: 'Material Unit', label: 'Material Unit', icon: Ruler, description: 'Units of measurement' },
  { key: 'Meralco Branch', label: 'Meralco Branch', icon: Building2, description: 'Meralco branches' },
  { key: 'Project Manager', label: 'Project Manager', icon: Users, description: 'People who can be assigned as project managers' },
  { key: 'Referred By', label: 'Referred By', icon: Users, description: 'Sources of project referrals' },
]

export default function Settings() {
  const queryClient = useQueryClient()
  const { isAdmin } = useAuth()
  const [activeTab, setActiveTab] = useState('Referred By')
  const [mainTab, setMainTab] = useState('dropdown')
  const [newValue, setNewValue] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')

  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supplierForm, setSupplierForm] = useState({
    name: '', address: '', contact_person: '', contact_number: ''
  })

  // Material Types state
  const [newTypeName, setNewTypeName] = useState('')
  const [editingTypeId, setEditingTypeId] = useState(null)
  const [editTypeName, setEditTypeName] = useState('')
  const [expandedType, setExpandedType] = useState(null)
  const [newBrandName, setNewBrandName] = useState('')

  // Danger Zone state
  const [resetOpen, setResetOpen] = useState(false)
  const [resetText, setResetText] = useState('')

  // Company state
  const emptyCompanyForm = {
    company_name: '', short_name: '', address: '', contact_number: '',
    email: '', website: '', footer_text: '', default_signatory: '', signatory_position: ''
  }
  const [companyFormOpen, setCompanyFormOpen] = useState(false)
  const [editingCompany, setEditingCompany] = useState(null)
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm)

  const { data: settings = [] } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const { data: materialTypes = [] } = useQuery({ queryKey: ['materialTypes'], queryFn: getMaterialTypes })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies })

  const createMutation = useMutation({
    mutationFn: createSetting,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); setNewValue('') },
    onError: () => toast.error('Failed to add'),
  })

  const updateMutation = useMutation({
    mutationFn: updateSetting,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); setEditingId(null); setEditValue('') },
    onError: () => toast.error('Failed to update'),
  })

  const archiveMutation = useMutation({
    mutationFn: archiveSetting,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['settings'] }); toast.success('Item archived') },
    onError: () => toast.error('Failed to archive'),
  })

  const createTypeMutation = useMutation({
    mutationFn: createMaterialType,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materialTypes'] }); setNewTypeName(''); toast.success('Material type added') },
    onError: () => toast.error('Failed to add material type'),
  })

  const updateTypeMutation = useMutation({
    mutationFn: updateMaterialType,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materialTypes'] }); setEditingTypeId(null); setEditTypeName('') },
    onError: () => toast.error('Failed to update'),
  })

  const archiveTypeMutation = useMutation({
    mutationFn: archiveMaterialType,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materialTypes'] }); toast.success('Material type archived') },
    onError: () => toast.error('Failed to archive'),
  })

  const addBrandMutation = useMutation({
    mutationFn: addBrandToType,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materialTypes'] }); setNewBrandName('') },
    onError: (err) => toast.error(err?.response?.data?.detail || 'Failed to add brand'),
  })

  const removeBrandMutation = useMutation({
    mutationFn: removeBrandFromType,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['materialTypes'] }) },
    onError: () => toast.error('Failed to remove brand'),
  })

  const closeCompanyForm = () => { setCompanyFormOpen(false); setEditingCompany(null); setCompanyForm(emptyCompanyForm) }

  const createCompanyMutation = useMutation({
    mutationFn: createCompany,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); closeCompanyForm(); toast.success('Company added') },
    onError: () => toast.error('Failed to save company'),
  })

  const updateCompanyMutation = useMutation({
    mutationFn: updateCompany,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); closeCompanyForm(); toast.success('Company updated') },
    onError: () => toast.error('Failed to update company'),
  })

  const deleteCompanyMutation = useMutation({
    mutationFn: deleteCompany,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['companies'] }); toast.success('Company deleted') },
    onError: () => toast.error('Failed to delete company'),
  })

  const resetMutation = useMutation({
    mutationFn: resetAllData,
    onSuccess: () => {
      queryClient.invalidateQueries()
      setResetOpen(false)
      setResetText('')
      toast.success('All data has been reset.')
    },
    onError: () => toast.error('Reset failed.'),
  })

  const handleAdd = () => {
    if (!newValue.trim()) return
    createMutation.mutate({ category: activeTab, value: newValue.trim(), is_active: true })
  }

  const handleSaveEdit = (id) => {
    if (!editValue.trim()) return
    updateMutation.mutate({ id, data: { value: editValue.trim() } })
  }

  const filteredSettings = settings
    .filter(s => s.category === activeTab && !s.archived)
    .sort((a, b) => (a.value || '').localeCompare(b.value || ''))

  const activeCategory = CATEGORIES.find(c => c.key === activeTab)

  const { data: suppliers = [] } = useQuery({ queryKey: ['suppliers'], queryFn: getSuppliers })

  const createSupplierMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setSupplierFormOpen(false); setSupplierForm({ name: '', address: '', contact_person: '', contact_number: '' }); toast.success('Supplier added') },
    onError: () => toast.error('Failed to add supplier'),
  })

  const updateSupplierMutation = useMutation({
    mutationFn: updateSupplier,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); setSupplierFormOpen(false); setEditingSupplier(null); toast.success('Supplier updated') },
    onError: () => toast.error('Failed to update supplier'),
  })

  const archiveSupplierMutation = useMutation({
    mutationFn: archiveSupplier,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['suppliers'] }); toast.success('Supplier archived') },
    onError: () => toast.error('Failed to archive supplier'),
  })

  return (
    <Layout>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage dropdown options used throughout the application</p>
        </div>

        {/* Main tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[['dropdown', 'Dropdown Options'], ['material_types', 'Material Types'], ['suppliers', 'Suppliers'], ['companies', 'Company Settings']].map(([val, label]) => (
            <button key={val} onClick={() => setMainTab(val)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${mainTab === val ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Dropdown Options Tab */}
        {mainTab === 'dropdown' && (
          <div className="flex gap-6">
            <div className="w-56 flex-shrink-0">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon
                  const count = settings.filter(s => s.category === cat.key && !s.archived).length
                  return (
                    <button key={cat.key} onClick={() => setActiveTab(cat.key)}
                      className={`flex items-center gap-3 px-4 py-3 w-full text-left border-b border-gray-100 last:border-0 transition-colors ${activeTab === cat.key ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-600'}`}>
                      <Icon size={15} className={activeTab === cat.key ? 'text-gray-300' : 'text-gray-400'} />
                      <span className="text-sm font-medium flex-1">{cat.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${activeTab === cat.key ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex-1">
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {activeCategory && <activeCategory.icon size={18} className="text-gray-500" />}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{activeCategory?.label}</h3>
                      <p className="text-xs text-gray-400">{activeCategory?.description}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex gap-2 mb-5">
                    <input value={newValue} onChange={e => setNewValue(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAdd()}
                      placeholder={`Add new ${activeCategory?.label.toLowerCase()}...`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                    <button onClick={handleAdd} disabled={!newValue.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50">
                      <Plus size={15} /> Add
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {filteredSettings.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No items yet. Add your first {activeCategory?.label.toLowerCase()}.
                      </div>
                    ) : filteredSettings.map(setting => (
                      <div key={setting.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-md group">
                        {editingId === setting.id ? (
                          <>
                            <input value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                            <button onClick={() => handleSaveEdit(setting.id)}
                              className="p-1 rounded hover:bg-emerald-100 text-emerald-600"><Check size={15} /></button>
                            <button onClick={() => setEditingId(null)}
                              className="p-1 rounded hover:bg-gray-200 text-gray-500"><X size={15} /></button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-sm text-gray-700 font-medium">{setting.value}</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingId(setting.id); setEditValue(setting.value) }}
                                className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                              <button onClick={() => archiveMutation.mutate(setting.id)}
                                className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Material Types Tab */}
        {mainTab === 'material_types' && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Material Types & Brands</h3>
                  <p className="text-xs text-gray-400">Each material type can have multiple brands</p>
                </div>
              </div>
              <div className="p-6">
                {/* Add new type */}
                <div className="flex gap-2 mb-6">
                  <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && newTypeName.trim() && createTypeMutation.mutate({ name: newTypeName.trim() })}
                    placeholder="Add new material type..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                  <button onClick={() => newTypeName.trim() && createTypeMutation.mutate({ name: newTypeName.trim() })}
                    disabled={!newTypeName.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-700 disabled:opacity-50">
                    <Plus size={15} /> Add
                  </button>
                </div>

                {/* Material types list */}
                <div className="space-y-2">
                  {materialTypes.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No material types yet.</div>
                  ) : materialTypes.map(mt => (
                    <div key={mt.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Type header */}
                      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 group">
                        {editingTypeId === mt.id ? (
                          <>
                            <input value={editTypeName} onChange={e => setEditTypeName(e.target.value)} autoFocus
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                            <button onClick={() => updateTypeMutation.mutate({ id: mt.id, data: { name: editTypeName } })}
                              className="p-1 rounded hover:bg-emerald-100 text-emerald-600"><Check size={15} /></button>
                            <button onClick={() => setEditingTypeId(null)}
                              className="p-1 rounded hover:bg-gray-200 text-gray-500"><X size={15} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => setExpandedType(expandedType === mt.id ? null : mt.id)}
                              className="flex-1 text-left">
                              <span className="text-sm font-semibold text-gray-800">{mt.name}</span>
                              <span className="text-xs text-gray-400 ml-2">({mt.brands.length} brands)</span>
                            </button>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingTypeId(mt.id); setEditTypeName(mt.name) }}
                                className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                              <button onClick={() => archiveTypeMutation.mutate(mt.id)}
                                className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                            </div>
                            <button onClick={() => setExpandedType(expandedType === mt.id ? null : mt.id)}
                              className="text-xs text-gray-400 px-2">
                              {expandedType === mt.id ? '▲' : '▼'}
                            </button>
                          </>
                        )}
                      </div>

                      {/* Brands section */}
                      {expandedType === mt.id && (
                        <div className="px-4 py-3 border-t border-gray-100">
                          {/* Add brand from dropdown */}
                          <div className="flex gap-2 mb-3">
                            <select value={newBrandName} onChange={e => setNewBrandName(e.target.value)}
                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                              <option value="">Select brand to add...</option>
                              {settings
                                .filter(s => s.category === 'Brand' && s.is_active)
                                .filter(s => !mt.brands.some(b => b.brand_name === s.value))
                                .map(s => <option key={s.id} value={s.value}>{s.value}</option>)
                              }
                            </select>
                            <button
                              onClick={() => newBrandName.trim() && addBrandMutation.mutate({ typeId: mt.id, brand_name: newBrandName.trim() })}
                              disabled={!newBrandName.trim()}
                              className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 text-white rounded-md text-xs hover:bg-gray-700 disabled:opacity-50">
                              <Plus size={13} /> Add
                            </button>
                          </div>
                          {/* Brand list */}
                          {mt.brands.length === 0 ? (
                            <p className="text-xs text-gray-400 py-2">No brands yet — add one above.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {mt.brands.map(brand => (
                                <div key={brand.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                                  {brand.brand_name}
                                  <button onClick={() => removeBrandMutation.mutate({ typeId: mt.id, brandId: brand.id })}
                                    className="text-gray-400 hover:text-red-500 ml-0.5">
                                    <X size={11} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Suppliers Tab */}
        {mainTab === 'suppliers' && (
          <div className="max-w-2xl">
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Suppliers</h3>
                  <p className="text-xs text-gray-400">Manage material suppliers</p>
                </div>
                <button
                  onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', address: '', contact_person: '', contact_number: '' }); setSupplierFormOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-700">
                  <Plus size={15} /> Add Supplier
                </button>
              </div>
              <div className="p-6 space-y-3">
                {suppliers.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No suppliers yet.</div>
                ) : suppliers.map(supplier => (
                  <div key={supplier.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg group">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{supplier.name}</p>
                      {supplier.address && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={11} />{supplier.address}
                        </p>
                      )}
                      {supplier.contact_person && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Users size={11} />{supplier.contact_person}
                        </p>
                      )}
                      {supplier.contact_number && (
                        <p className="text-xs text-gray-500 mt-0.5">📞 {supplier.contact_number}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingSupplier(supplier); setSupplierForm({ name: supplier.name, address: supplier.address || '', contact_person: supplier.contact_person || '', contact_number: supplier.contact_number || '' }); setSupplierFormOpen(true) }}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"><Pencil size={13} /></button>
                      <button onClick={() => archiveSupplierMutation.mutate(supplier.id)}
                        className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {/* Supplier Form Dialog */}
        {supplierFormOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
              <div className="flex items-center justify-between px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
                </h2>
                <button onClick={() => setSupplierFormOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Supplier Name *</label>
                  <input value={supplierForm.name} onChange={e => setSupplierForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
                  <input value={supplierForm.address} onChange={e => setSupplierForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact Person</label>
                  <input value={supplierForm.contact_person} onChange={e => setSupplierForm(p => ({ ...p, contact_person: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Contact Number</label>
                  <input value={supplierForm.contact_number} onChange={e => setSupplierForm(p => ({ ...p, contact_number: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t">
                <button onClick={() => setSupplierFormOpen(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button
                  onClick={() => {
                    if (editingSupplier) {
                      updateSupplierMutation.mutate({ id: editingSupplier.id, data: supplierForm })
                    } else {
                      createSupplierMutation.mutate(supplierForm)
                    }
                  }}
                  disabled={!supplierForm.name}
                  className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                  {editingSupplier ? 'Update' : 'Add'} Supplier
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Company Settings Tab */}
        {mainTab === 'companies' && (
          <div className="max-w-2xl space-y-6">
            {/* Company list */}
            <div className="bg-white border border-gray-200 rounded-lg">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Companies</h3>
                  <p className="text-xs text-gray-400">Company profiles used in quotations and documents</p>
                </div>
                <button
                  onClick={() => { setEditingCompany(null); setCompanyForm(emptyCompanyForm); setCompanyFormOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white rounded-md text-sm hover:bg-gray-700">
                  <Plus size={15} /> Add Company
                </button>
              </div>
              <div className="p-6 space-y-3">
                {companies.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No companies yet. Add your first one.</div>
                ) : companies.map(company => (
                  <div key={company.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{company.company_name}</p>
                        {company.short_name && (
                          <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded text-xs">{company.short_name}</span>
                        )}
                      </div>
                      {company.address && <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><MapPin size={11} />{company.address}</p>}
                      {company.contact_number && <p className="text-xs text-gray-500 mt-0.5">{company.contact_number}</p>}
                      {company.email && <p className="text-xs text-gray-500 mt-0.5">{company.email}</p>}
                      {company.default_signatory && (
                        <p className="text-xs text-gray-400 mt-1 italic">{company.default_signatory}{company.signatory_position ? ` — ${company.signatory_position}` : ''}</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => {
                          setEditingCompany(company)
                          setCompanyForm({
                            company_name: company.company_name || '',
                            short_name: company.short_name || '',
                            address: company.address || '',
                            contact_number: company.contact_number || '',
                            email: company.email || '',
                            website: company.website || '',
                            footer_text: company.footer_text || '',
                            default_signatory: company.default_signatory || '',
                            signatory_position: company.signatory_position || '',
                          })
                          setCompanyFormOpen(true)
                        }}
                        className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteCompanyMutation.mutate(company.id)}
                        className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger Zone — Admin only */}
            {isAdmin() && (
              <div className="border border-red-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 bg-red-50 border-b border-red-200">
                  <AlertTriangle size={16} className="text-red-500" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-700">Danger Zone</h3>
                    <p className="text-xs text-red-500">These actions are irreversible. Use only during testing.</p>
                  </div>
                </div>
                <div className="px-6 py-4 bg-white flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Reset All Data</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Wipes employees, projects, attendance, transactions, materials, suppliers, and inventory.
                      Settings and dropdown options are kept.
                    </p>
                  </div>
                  <button
                    onClick={() => { setResetOpen(true); setResetText('') }}
                    className="ml-6 flex-shrink-0 px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 font-medium"
                  >
                    Reset Data
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Company Form Dialog */}
      {companyFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg m-4 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{editingCompany ? 'Edit Company' : 'Add Company'}</h2>
              <button onClick={closeCompanyForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto">
              {[
                ['company_name', 'Company Name *', 'text'],
                ['short_name', 'Short Name', 'text'],
                ['address', 'Address', 'text'],
                ['contact_number', 'Contact Number', 'text'],
                ['email', 'Email', 'email'],
                ['website', 'Website', 'url'],
                ['default_signatory', 'Default Signatory', 'text'],
                ['signatory_position', 'Signatory Position', 'text'],
              ].map(([field, label, type]) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                  <input type={type} value={companyForm[field]}
                    onChange={e => setCompanyForm(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Footer Text</label>
                <textarea value={companyForm.footer_text} rows={2}
                  onChange={e => setCompanyForm(p => ({ ...p, footer_text: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t flex-shrink-0">
              <button onClick={closeCompanyForm} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => {
                  if (editingCompany) {
                    updateCompanyMutation.mutate({ id: editingCompany.id, data: companyForm })
                  } else {
                    createCompanyMutation.mutate(companyForm)
                  }
                }}
                disabled={!companyForm.company_name}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
                {editingCompany ? 'Update' : 'Add'} Company
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {resetOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md m-4">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-red-100 bg-red-50 rounded-t-lg">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-lg font-semibold text-red-700">Confirm Data Reset</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-700">
                This will permanently delete all <strong>employees, projects, attendance records, transactions, materials, suppliers, and inventory</strong>. Settings and lookup values will be kept.
              </p>
              <p className="text-sm text-gray-700">
                Type <strong className="font-mono text-red-600">RESET</strong> below to confirm.
              </p>
              <input
                value={resetText}
                onChange={e => setResetText(e.target.value)}
                placeholder="Type RESET to confirm"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-400 font-mono"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t">
              <button
                onClick={() => { setResetOpen(false); setResetText('') }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => resetMutation.mutate()}
                disabled={resetText !== 'RESET' || resetMutation.isPending}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 font-medium"
              >
                {resetMutation.isPending ? 'Resetting...' : 'Reset All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}