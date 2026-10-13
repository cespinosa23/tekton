import { useState } from 'react'
import { format } from 'date-fns'
import { CheckCircle, X } from 'lucide-react'
import { formatBillingSerial } from '../utils/billingSerial'

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Asks for the date a billing was actually paid before marking it paid —
// that date becomes the billing's paid date and the date of the Payment
// transaction it records. Used by the project Billing tab and the Billings page.
export default function MarkPaidDialog({ billing, projectName, onConfirm, onCancel, loading }) {
  const [paidDate, setPaidDate] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd') // local date, not UTC
  const valid = paidDate && paidDate <= today

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <CheckCircle size={18} className="text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-900">Mark as Paid</h2>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <form className="px-6 py-4 space-y-4" onSubmit={e => { e.preventDefault(); if (valid) onConfirm(paidDate) }}>
          <div className="rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Billing</span><span className="font-mono">{formatBillingSerial(billing)}</span></div>
            {projectName && <div className="flex justify-between gap-3"><span className="text-gray-500">Project</span><span className="text-right">{projectName}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-semibold text-emerald-700">{fmt(billing.amount)}</span></div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date paid *</label>
            <input type="date" value={paidDate} max={today} onChange={e => setPaidDate(e.target.value)} autoFocus required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-400" />
            {paidDate > today && <p className="text-xs text-red-600 mt-1">The paid date can't be in the future.</p>}
            <p className="text-xs text-gray-500 mt-1.5">This becomes the paid date, and a Payment of {fmt(billing.amount)} is recorded in Transactions on this date.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCancel} className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!valid || loading}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">
              {loading ? 'Saving...' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
