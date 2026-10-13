import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { setBillingPrintDate } from '../api/billing'
import { formatBillingSerial } from '../utils/billingSerial'
import { apiErrorMessage } from '../utils/apiError'

// "Print Billing Request": pick the company profile and the date shown on the
// letter. The first date chosen is saved on the billing (print_date) and
// pre-fills every later print; each print can still use a different date,
// which applies to that print only. Used by the project Billing tab and the
// Billings page.
export default function PrintBillingDialog({ billing, companies, onClose }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '')
  const [letterDate, setLetterDate] = useState(billing.print_date || '')
  const [error, setError] = useState('')

  const saveFirstDate = useMutation({
    mutationFn: setBillingPrintDate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['billings'] }),
  })

  const goToPrint = () => navigate(`/projects/${billing.project_id}/billing/${billing.id}/print?company=${companyId}&date=${letterDate}`)

  const handleContinue = async () => {
    setError('')
    if (!billing.print_date) {
      try {
        await saveFirstDate.mutateAsync({ id: billing.id, print_date: letterDate })
      } catch (err) {
        setError(apiErrorMessage(err, 'Could not save the date. Try again.'))
        return
      }
    }
    goToPrint()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Print Billing Request</h3>
            <p className="text-xs text-gray-500 font-mono">{formatBillingSerial(billing)}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {companies.length === 0 ? (
            <p className="text-sm text-gray-500">
              No company profiles yet. Add one in <span className="font-medium">Settings → Company Settings</span> first.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Print using company profile</label>
                <select value={companyId} onChange={e => setCompanyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400">
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date on letter *</label>
                <input type="date" value={letterDate} onChange={e => setLetterDate(e.target.value)} required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
                <p className="text-xs text-gray-500 mt-1.5">
                  {billing.print_date
                    ? 'Pre-filled with the date saved on first print. Changing it applies to this print only.'
                    : 'First print: this date is saved and pre-filled next time.'}
                </p>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          {companies.length > 0 && (
            <button onClick={handleContinue} disabled={!letterDate || !companyId || saveFirstDate.isPending}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700 disabled:opacity-50">
              {saveFirstDate.isPending ? 'Saving...' : 'Continue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
