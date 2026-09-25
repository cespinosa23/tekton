import { useState, useRef } from 'react'
import { Download, Upload, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { downloadBomImportTemplate, parseBomImportFile, matchImportRows } from '../../lib/bomImport'

const fmt = (n) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

// Upload -> parse/match -> preview -> confirm. Rows are only handed to the
// caller (and written into the BOM) after an explicit confirm — never
// straight off the file upload — so a wrong file or misread sheet doesn't
// silently dump bad rows into the quotation.
export default function BomImportModal({ open, onClose, materialTypes = [], materials = [], inventoryRecords = [], onImport }) {
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { rows, matchedCount, reviewCount }
  const fileInputRef = useRef(null)

  if (!open) return null

  const reset = () => { setError(''); setResult(null); setBusy(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  const close = () => { reset(); onClose() }

  const handleDownloadTemplate = async () => {
    setError('')
    setDownloading(true)
    try {
      await downloadBomImportTemplate(materialTypes, materials)
    } catch (err) {
      setError(err.message || 'Could not generate the template.')
    } finally {
      setDownloading(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const parsed = await parseBomImportFile(file)
      setResult(matchImportRows(parsed, { materials, inventoryRecords }))
    } catch (err) {
      setError(err.message || 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  const confirmImport = () => {
    if (!result) return
    onImport(result.rows)
    close()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl m-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-semibold text-gray-900">Import Materials from Excel</h3>
          <button onClick={close} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Upload a filled-in copy of the template below to add several materials to this BOM at once.
        </p>

        <button onClick={handleDownloadTemplate} disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-md text-sm hover:bg-gray-50 text-gray-600 mb-4 disabled:opacity-50 disabled:cursor-wait">
          <Download size={14} /> {downloading ? 'Generating…' : 'Download Template'}
        </button>

        {!result && (
          <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg py-8 text-sm ${
            busy ? 'border-gray-200 text-gray-300 cursor-wait' : 'border-gray-300 text-gray-500 hover:bg-gray-50 cursor-pointer'
          }`}>
            <Upload size={20} />
            {busy ? 'Reading file…' : 'Click to upload the filled-in template (.xlsx)'}
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFile} disabled={busy} className="hidden" />
          </label>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
                <CheckCircle2 size={14} /> {result.matchedCount} matched
              </div>
              {result.reviewCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-700">
                  <AlertTriangle size={14} /> {result.reviewCount} need manual pricing
                </div>
              )}
            </div>

            <div className="overflow-y-auto max-h-64 border border-gray-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    {['Type', 'Material', 'Unit', 'Qty', 'Price', 'Status'].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.rows.map((row, i) => (
                    <tr key={i} className={row.needs_review ? 'bg-amber-50/50' : 'bg-white'}>
                      <td className="px-3 py-2 text-gray-700">{row.material_type || '—'}</td>
                      <td className="px-3 py-2 text-gray-900">{row.material_name || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{row.unit || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{fmt(row.quantity)}</td>
                      <td className="px-3 py-2 text-gray-700">{row.needs_review ? '—' : `₱${fmt(row.unit_price)}`}</td>
                      <td className="px-3 py-2">
                        {row.needs_review
                          ? <span className="text-amber-600 text-xs font-medium">Needs review</span>
                          : <span className="text-green-600 text-xs font-medium">Matched</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={reset} className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-600">
                Upload a different file
              </button>
              <button onClick={confirmImport} className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800">
                Import {result.rows.length} Row{result.rows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
