import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import Layout from '../components/Layout'
import { getQuotations, createQuotation, updateQuotation, archiveQuotation } from '../api/quotations'
import { getCompanies } from '../api/settings'
import { getMaterials } from '../api/materials'
import { usePermissions } from '../hooks/usePermissions'
import BOMEditor from '../components/quotation/BOMEditor'
import OtherCostsEditor from '../components/quotation/OtherCostsEditor'
import QuotePreview from '../components/quotation/QuotePreview'
import { downloadQuoteAsDocx } from '../components/quotation/generateQuoteDoc'
import {
  Plus, FileText, Eye, Download, CheckCircle, ArrowLeft, Pencil, Archive, X,
  Copy, Lock, Printer, Search,
} from 'lucide-react'

const STEPS_SOLAR = [
  'Template & Company', 'Addressee', 'Solar Details', 'Scope of Works',
  'Bill of Materials', 'Other Costs', 'Payment Terms', 'Notes & Exclusions', 'Preview',
]
const STEPS_TRADITIONAL = [
  'Template & Company', 'Addressee', 'Scope of Works',
  'Bill of Materials', 'Other Costs', 'Payment Terms', 'Notes & Exclusions', 'Preview',
]

const EMPTY_QUOTE = {
  template_type: 'Traditional',
  quote_number: '',
  status: 'Draft',
  company_name: '',
  company_address: '',
  company_contact: '',
  company_footer: '',
  company_logo_url: '',
  addressee_name: '',
  addressee_address: '',
  subject: '',
  quotation_date: format(new Date(), 'yyyy-MM-dd'),
  signatory_name: '',
  signatory_title: '',
  project_cost: 0,
  estimated_savings: 0,
  roi: '',
  system_size_kwp: 0,
  inverter_brand: '',
  battery_brand: '',
  panel_brand: '',
  scope_of_works: '',
  terms_of_payment: '',
  bill_of_materials: [],
  other_scope_costs: [],
  mode_of_payment: '',
  notes: '',
  exclusions: '',
  total_contract_cost: 0,
}

const STATUS_COLORS = {
  Draft: 'bg-amber-100 text-amber-700',
  Finalized: 'bg-emerald-100 text-emerald-700',
}

const inp = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400'

function StepIndicator({ steps, current }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mb-8">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-1">
          <span className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            i === current ? 'bg-amber-500 text-white'
              : i < current ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {i < current && <CheckCircle size={11} />}
            {i + 1}. {s}
          </span>
          {i < steps.length - 1 && <span className="w-3 h-px bg-gray-200 block" />}
        </span>
      ))}
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function Quotations() {
  const queryClient = useQueryClient()
  const { canWrite } = usePermissions()
  const [view, setView] = useState('list')
  const [editingQuote, setEditingQuote] = useState(null)
  const [quoteData, setQuoteData] = useState(EMPTY_QUOTE)
  const [step, setStep] = useState(0)
  const [downloading, setDownloading] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(null)
  const [reopenConfirm, setReopenConfirm] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const { data: quotations = [], isLoading } = useQuery({ queryKey: ['quotations'], queryFn: getQuotations })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies })
  const { data: materials = [] } = useQuery({ queryKey: ['materials'], queryFn: getMaterials })
  const activeCompanies = companies.filter(c => c.is_active !== false)
  const activeMaterials = materials.filter(m => !m.archived)

  const createMutation = useMutation({
    mutationFn: createQuotation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] }),
  })
  const updateMutation = useMutation({
    mutationFn: updateQuotation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotations'] }),
  })
  const archiveMutation = useMutation({
    mutationFn: archiveQuotation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      setArchiveConfirm(null)
      toast.success('Quotation archived')
    },
    onError: () => toast.error('Failed to archive'),
  })

  const steps = quoteData.template_type === 'Solar' ? STEPS_SOLAR : STEPS_TRADITIONAL
  const isPreviewStep = steps[step] === 'Preview'
  const isLocked = editingQuote?.status === 'Finalized'

  const set = (field, value) => setQuoteData(prev => ({ ...prev, [field]: value }))

  const calcTotal = (data = quoteData) => {
    const bom = (data.bill_of_materials || []).reduce((s, i) => s + (i.subtotal || 0), 0)
    const other = (data.other_scope_costs || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)
    return bom + other
  }

  // Auto-generate Q-YYYY-NNN based on existing quotations for the current year
  const generateQuoteNumber = () => {
    const year = new Date().getFullYear()
    const yearPrefix = `Q-${year}-`
    const nums = quotations
      .filter(q => q.quote_number?.startsWith(yearPrefix))
      .map(q => parseInt(q.quote_number.slice(yearPrefix.length)) || 0)
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${yearPrefix}${String(next).padStart(3, '0')}`
  }

  const openBuilder = (quote = null) => {
    const base = quote ? { ...EMPTY_QUOTE, ...quote } : { ...EMPTY_QUOTE, quote_number: generateQuoteNumber() }
    setQuoteData(base)
    setEditingQuote(quote)
    setStep(0)
    setView('builder')
  }

  const handleClone = (quote) => {
    // eslint-disable-next-line no-unused-vars
    const { id, created_at, updated_at, ...rest } = quote
    setQuoteData({
      ...EMPTY_QUOTE,
      ...rest,
      status: 'Draft',
      quote_number: generateQuoteNumber(),
      quotation_date: format(new Date(), 'yyyy-MM-dd'),
    })
    setEditingQuote(null)
    setStep(0)
    setView('builder')
  }

  const handleReopenFromBuilder = async () => {
    const data = { ...quoteData, status: 'Draft' }
    await updateMutation.mutateAsync({ id: editingQuote.id, data })
    setEditingQuote(prev => ({ ...prev, status: 'Draft' }))
    setQuoteData(prev => ({ ...prev, status: 'Draft' }))
    toast.success('Re-opened as Draft')
  }

  const applyCompany = (companyId) => {
    const c = companies.find(co => String(co.id) === String(companyId))
    if (!c) return
    setQuoteData(prev => ({
      ...prev,
      company_name: c.company_name || prev.company_name,
      company_address: c.address || prev.company_address,
      company_contact: [c.contact_number, c.email].filter(Boolean).join(' · ') || prev.company_contact,
      company_logo_url: c.logo_url || prev.company_logo_url,
      company_footer: c.footer_text || prev.company_footer,
      signatory_name: c.default_signatory || prev.signatory_name,
      signatory_title: c.signatory_position || prev.signatory_title,
    }))
  }

  const handleSaveDraft = async () => {
    const data = { ...quoteData, total_contract_cost: calcTotal(), status: 'Draft' }
    if (editingQuote) {
      await updateMutation.mutateAsync({ id: editingQuote.id, data })
      toast.success('Draft saved')
    } else {
      const created = await createMutation.mutateAsync(data)
      setEditingQuote(created)
      toast.success('Draft saved')
    }
  }

  const handleFinalize = async () => {
    const data = { ...quoteData, total_contract_cost: calcTotal(), status: 'Finalized' }
    if (editingQuote) {
      await updateMutation.mutateAsync({ id: editingQuote.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
    toast.success('Quotation finalized')
    setView('list')
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const data = { ...quoteData, total_contract_cost: calcTotal() }
      if (editingQuote) {
        await updateMutation.mutateAsync({ id: editingQuote.id, data: { ...data, status: 'Finalized' } })
      } else {
        const created = await createMutation.mutateAsync({ ...data, status: 'Finalized' })
        setEditingQuote(created)
      }
      await downloadQuoteAsDocx(data)
      toast.success('Downloaded — quotation finalized')
    } catch {
      toast.error('Download failed')
    }
    setDownloading(false)
  }

  const activeQuotes = quotations.filter(q => !q.archived)

  const filteredQuotes = activeQuotes.filter(q => {
    const s = search.toLowerCase()
    const matchSearch = !s ||
      q.addressee_name?.toLowerCase().includes(s) ||
      q.subject?.toLowerCase().includes(s) ||
      q.quote_number?.toLowerCase().includes(s)
    const matchStatus = statusFilter === 'all' || q.status === statusFilter
    return matchSearch && matchStatus
  })

  // ── Step content ──────────────────────────────────────────────
  const renderStep = () => {
    const s = steps[step]

    if (s === 'Template & Company') return (
      <div className="space-y-6">
        {activeCompanies.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <label className="block text-sm font-semibold text-amber-800 mb-2">Quick-fill from Company</label>
            <select
              onChange={e => applyCompany(e.target.value)}
              className="w-full px-3 py-2 border border-amber-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              defaultValue=""
            >
              <option value="" disabled>Choose a company to auto-fill branding…</option>
              {activeCompanies.map(c => (
                <option key={c.id} value={c.id}>{c.company_name}{c.short_name ? ` (${c.short_name})` : ''}</option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Template Type" required>
            <select value={quoteData.template_type}
              onChange={e => { set('template_type', e.target.value); setStep(0) }}
              className={inp} disabled={isLocked}>
              <option value="Traditional">Traditional</option>
              <option value="Solar">Solar</option>
            </select>
          </Field>
          <Field label="Quote Number">
            <input value={quoteData.quote_number} onChange={e => set('quote_number', e.target.value)}
              placeholder="e.g. Q-2026-001" className={inp} disabled={isLocked} />
          </Field>
          <Field label="Quotation Date">
            <input type="date" value={quoteData.quotation_date} onChange={e => set('quotation_date', e.target.value)} className={inp} disabled={isLocked} />
          </Field>
          <Field label="Company Name">
            <input value={quoteData.company_name} onChange={e => set('company_name', e.target.value)} className={inp} disabled={isLocked} />
          </Field>
          <Field label="Company Address">
            <input value={quoteData.company_address} onChange={e => set('company_address', e.target.value)} className={inp} disabled={isLocked} />
          </Field>
          <Field label="Contact (Phone / Email)">
            <input value={quoteData.company_contact} onChange={e => set('company_contact', e.target.value)} className={inp} disabled={isLocked} />
          </Field>
          <Field label="Footer Text">
            <input value={quoteData.company_footer} onChange={e => set('company_footer', e.target.value)}
              placeholder="e.g. Registered contractor…" className={inp} disabled={isLocked} />
          </Field>
          <Field label="Signatory Name">
            <input value={quoteData.signatory_name} onChange={e => set('signatory_name', e.target.value)} className={inp} disabled={isLocked} />
          </Field>
          <Field label="Signatory Title">
            <input value={quoteData.signatory_title} onChange={e => set('signatory_title', e.target.value)} className={inp} disabled={isLocked} />
          </Field>
        </div>
      </div>
    )

    if (s === 'Addressee') return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Client / Addressee Name" required>
          <input value={quoteData.addressee_name} onChange={e => set('addressee_name', e.target.value)}
            placeholder="Client or company name" className={inp} disabled={isLocked} />
        </Field>
        <Field label="Address">
          <input value={quoteData.addressee_address} onChange={e => set('addressee_address', e.target.value)} className={inp} disabled={isLocked} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Subject">
            <input value={quoteData.subject} onChange={e => set('subject', e.target.value)}
              placeholder="e.g. Electrical Installation — Main Building" className={inp} disabled={isLocked} />
          </Field>
        </div>
      </div>
    )

    if (s === 'Solar Details') return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="System Size (kWp)">
          <input type="number" value={quoteData.system_size_kwp} onChange={e => set('system_size_kwp', parseFloat(e.target.value) || 0)} className={inp} disabled={isLocked} />
        </Field>
        <Field label="Project Cost (₱)">
          <input type="number" value={quoteData.project_cost} onChange={e => set('project_cost', parseFloat(e.target.value) || 0)} className={inp} disabled={isLocked} />
        </Field>
        <Field label="Estimated Monthly Savings (₱)">
          <input type="number" value={quoteData.estimated_savings} onChange={e => set('estimated_savings', parseFloat(e.target.value) || 0)} className={inp} disabled={isLocked} />
        </Field>
        <Field label="Return on Investment">
          <input value={quoteData.roi} onChange={e => set('roi', e.target.value)} placeholder="e.g. 5 years" className={inp} disabled={isLocked} />
        </Field>
        <Field label="Inverter Brand">
          <input value={quoteData.inverter_brand} onChange={e => set('inverter_brand', e.target.value)} className={inp} disabled={isLocked} />
        </Field>
        <Field label="Battery Brand">
          <input value={quoteData.battery_brand} onChange={e => set('battery_brand', e.target.value)} className={inp} disabled={isLocked} />
        </Field>
        <Field label="Panel Brand">
          <input value={quoteData.panel_brand} onChange={e => set('panel_brand', e.target.value)} className={inp} disabled={isLocked} />
        </Field>
      </div>
    )

    if (s === 'Scope of Works') return (
      <Field label="Scope of Works">
        <textarea value={quoteData.scope_of_works} onChange={e => set('scope_of_works', e.target.value)}
          rows={12} placeholder="Describe the scope of works…"
          className={`${inp} font-mono resize-y`} disabled={isLocked} />
      </Field>
    )

    if (s === 'Bill of Materials') return (
      <BOMEditor
        items={quoteData.bill_of_materials}
        onChange={items => set('bill_of_materials', items)}
        materials={activeMaterials}
      />
    )

    if (s === 'Other Costs') return (
      <OtherCostsEditor items={quoteData.other_scope_costs} onChange={items => set('other_scope_costs', items)} />
    )

    if (s === 'Payment Terms') return (
      <div className="space-y-5">
        <Field label="Terms of Payment">
          <textarea value={quoteData.terms_of_payment} onChange={e => set('terms_of_payment', e.target.value)}
            rows={6} placeholder="e.g. 50% downpayment upon signing, 50% upon completion"
            className={`${inp} resize-y`} disabled={isLocked} />
        </Field>
        <Field label="Mode of Payment">
          <input value={quoteData.mode_of_payment} onChange={e => set('mode_of_payment', e.target.value)}
            placeholder="e.g. Bank Transfer, Check, Cash" className={inp} disabled={isLocked} />
        </Field>
      </div>
    )

    if (s === 'Notes & Exclusions') return (
      <div className="space-y-5">
        <Field label="Notes">
          <textarea value={quoteData.notes} onChange={e => set('notes', e.target.value)}
            rows={5} placeholder="Additional notes…" className={`${inp} resize-y`} disabled={isLocked} />
        </Field>
        <Field label="Exclusions">
          <textarea value={quoteData.exclusions} onChange={e => set('exclusions', e.target.value)}
            rows={5} placeholder="What is NOT included in this quotation…" className={`${inp} resize-y`} disabled={isLocked} />
        </Field>
      </div>
    )

    if (s === 'Preview') return (
      <QuotePreview quote={{ ...quoteData, total_contract_cost: calcTotal() }} />
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────────
  if (view === 'list') return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage project quotations</p>
          </div>
          {canWrite('quotations') && (
            <button onClick={() => openBuilder()}
              className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700">
              <Plus size={16} /> New Quotation
            </button>
          )}
        </div>

        {/* Search + filter bar */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by client, subject, or quote number…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Finalized">Finalized</option>
          </select>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : activeQuotes.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-600">No quotations yet</p>
            <p className="text-sm mt-1">Click "New Quotation" to create your first one.</p>
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Search size={36} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">No quotations match your search</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuotes.map(q => (
              <div key={q.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4 hover:shadow-sm transition-shadow">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-900">{q.addressee_name || 'Unnamed'}</span>
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{q.template_type}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-600'}`}>{q.status}</span>
                    {q.quote_number && <span className="text-xs text-gray-400">#{q.quote_number}</span>}
                  </div>
                  <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-3">
                    {q.subject && <span>{q.subject}</span>}
                    {q.quotation_date && <span>{format(new Date(q.quotation_date + 'T00:00:00'), 'MMM d, yyyy')}</span>}
                    {q.total_contract_cost > 0 && (
                      <span className="font-medium text-gray-700">₱{Number(q.total_contract_cost).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {canWrite('quotations') && (
                    q.status === 'Finalized' ? (
                      <button
                        onClick={() => setReopenConfirm(q)}
                        className="p-1.5 rounded hover:bg-amber-50 text-gray-400 hover:text-amber-600"
                        title="Finalized — click to re-open as Draft">
                        <Lock size={15} />
                      </button>
                    ) : (
                      <button onClick={() => openBuilder(q)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Edit">
                        <Pencil size={15} />
                      </button>
                    )
                  )}
                  {canWrite('quotations') && (
                    <button onClick={() => handleClone(q)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Clone / Duplicate">
                      <Copy size={15} />
                    </button>
                  )}
                  <button
                    onClick={() => { setQuoteData({ ...EMPTY_QUOTE, ...q }); setView('preview') }}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Preview">
                    <Eye size={15} />
                  </button>
                  {canWrite('quotations') && (
                    <button onClick={() => setArchiveConfirm(q)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500" title="Archive">
                      <Archive size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Archive confirm dialog */}
        {archiveConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Archive Quotation</h3>
              <p className="text-sm text-gray-500 mb-6">Archive quotation for <strong>{archiveConfirm.addressee_name || 'this client'}</strong>?</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setArchiveConfirm(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button onClick={() => archiveMutation.mutate(archiveConfirm.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">
                  <Archive size={14} /> Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Re-open (finalized) confirm dialog */}
        {reopenConfirm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-sm m-4 p-6">
              <div className="flex items-center gap-3 mb-3">
                <Lock size={20} className="text-amber-500 flex-shrink-0" />
                <h3 className="text-lg font-semibold text-gray-900">Re-open Quotation?</h3>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                <strong>{reopenConfirm.quote_number || 'This quotation'}</strong> is <strong>Finalized</strong>.
                Re-opening it will change the status back to <strong>Draft</strong> and allow editing.
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setReopenConfirm(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                <button
                  onClick={async () => {
                    try {
                      await updateMutation.mutateAsync({ id: reopenConfirm.id, data: { ...reopenConfirm, status: 'Draft' } })
                      openBuilder({ ...reopenConfirm, status: 'Draft' })
                      setReopenConfirm(null)
                      toast.success('Re-opened as Draft')
                    } catch {
                      toast.error('Failed to re-open')
                    }
                  }}
                  disabled={updateMutation.isPending}
                  className="px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50">
                  Re-open as Draft
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )

  // ── FULL PREVIEW (from list) ──────────────────────────────────
  if (view === 'preview') return (
    <Layout>
      <div className="p-8">
        <div className="mb-6 flex items-center gap-4 print:hidden">
          <button onClick={() => setView('list')} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
            <ArrowLeft size={15} /> Back
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
            <Printer size={15} /> Print
          </button>
          <button
            onClick={async () => { setDownloading(true); await downloadQuoteAsDocx(quoteData); setDownloading(false) }}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
            <Download size={15} /> {downloading ? 'Generating…' : 'Download Word'}
          </button>
        </div>
        <QuotePreview quote={quoteData} />
      </div>
    </Layout>
  )

  // ── BUILDER VIEW ──────────────────────────────────────────────
  return (
    <Layout>
      <div className="p-8">
        {/* Builder header */}
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setView('list')} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50">
            <ArrowLeft size={15} /> Back
          </button>
          <h1 className="text-xl font-bold text-gray-900">
            {editingQuote ? 'Edit Quotation' : 'New Quotation'}
          </h1>
          {editingQuote && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[editingQuote.status] || 'bg-gray-100 text-gray-600'}`}>
              {editingQuote.status}
            </span>
          )}
        </div>

        {/* Finalized lock banner */}
        {isLocked && (
          <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-amber-800">
              <Lock size={15} />
              <span className="text-sm font-medium">This quotation is Finalized — fields are read-only.</span>
            </div>
            <button
              onClick={handleReopenFromBuilder}
              disabled={updateMutation.isPending}
              className="text-sm px-3 py-1.5 bg-amber-500 text-white rounded-md hover:bg-amber-600 disabled:opacity-50">
              Re-open as Draft
            </button>
          </div>
        )}

        <StepIndicator steps={steps} current={step} />

        {/* Step card */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">{steps[step]}</h2>
          </div>
          <div className="px-6 py-6">
            {renderStep()}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button onClick={() => setStep(s => Math.max(s - 1, 0))} disabled={step === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-40">
            <ArrowLeft size={15} /> Back
          </button>

          <div className="flex gap-3">
            {!isLocked && (
              <button onClick={handleSaveDraft} disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50">
                Save Draft
              </button>
            )}

            {isPreviewStep ? (
              <>
                <button onClick={handleDownload} disabled={downloading || isLocked}
                  className="flex items-center gap-2 px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-md hover:bg-blue-50 disabled:opacity-50">
                  <Download size={15} /> {downloading ? 'Generating…' : 'Download Word'}
                </button>
                {!isLocked && (
                  <button onClick={handleFinalize} disabled={updateMutation.isPending || createMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">
                    <CheckCircle size={15} /> Finalize Quote
                  </button>
                )}
              </>
            ) : (
              <button onClick={() => setStep(s => Math.min(s + 1, steps.length - 1))}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-500 text-white rounded-md hover:bg-amber-600">
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
