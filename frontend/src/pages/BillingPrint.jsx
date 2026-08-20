import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { getProjects } from '../api/projects'
import { getBillings } from '../api/billing'
import { getCompanies } from '../api/settings'
import { formatBillingSerial } from '../utils/billingSerial'
import DocumentLetterhead from '../components/DocumentLetterhead'
import DocumentFooter from '../components/DocumentFooter'
import { ArrowLeft, Printer } from 'lucide-react'

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const ordinal = (n) => {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}

const SUBJECTS = {
  down_payment: 'DOWNPAYMENT REQUEST',
  progress: 'PROGRESS BILLING REQUEST',
  retention_release: 'RETENTION RELEASE REQUEST',
}

export default function BillingPrint() {
  const { id, billingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const companyId = searchParams.get('company')

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: billings = [] } = useQuery({ queryKey: ['billings'], queryFn: getBillings })
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: getCompanies })

  const project = projects.find(p => p.id === parseInt(id))
  const company = companies.find(c => c.id === parseInt(companyId))

  const allProjectBillings = billings
    .filter(b => b.project_id === parseInt(id))
    .sort((a, b) => a.sequence_number - b.sequence_number)

  const targetBilling = allProjectBillings.find(b => b.id === parseInt(billingId))
  const dpRow = allProjectBillings.find(b => b.billing_type === 'down_payment')

  if (!project || !targetBilling) {
    return (
      <div className="p-8 text-center text-gray-400">
        Billing not found.
        <button onClick={() => navigate(-1)} className="block mx-auto mt-4 text-sm text-gray-600 underline">Go back</button>
      </div>
    )
  }

  const cumulativeBillings = allProjectBillings.filter(b => b.sequence_number <= targetBilling.sequence_number)

  const progressOrdinals = {}
  allProjectBillings.filter(b => b.billing_type === 'progress').forEach((b, idx) => {
    progressOrdinals[b.id] = idx + 1
  })

  const remarkFor = (b) => {
    let label
    if (b.billing_type === 'down_payment') label = 'Downpayment'
    else if (b.billing_type === 'retention_release') label = 'Retention Release'
    else {
      label = `${ordinal(progressOrdinals[b.id])} Progress Billing`
      if (parseFloat(b.current_percentage) === 100) label += ' (Final)'
    }
    if (!b.is_paid) label += '*'
    return label
  }

  const hasPendingMarker = cumulativeBillings.some(b => !b.is_paid)

  const contractCost = parseFloat(project.contract_cost) || 0

  const bodyText = targetBilling.billing_type === 'down_payment'
    ? 'we would like to request your good office for the downpayment as stated in the terms of payment.'
    : targetBilling.billing_type === 'retention_release'
      ? 'we would like to request your good office for the release of retention as stated in the terms of payment.'
      : `we would like to request your good office for the ${targetBilling.current_percentage}% progress billing as stated in the terms of payment.`

  const handlePrint = () => {
    const originalTitle = document.title
    document.title = `${project.project_name} - ${formatBillingSerial(targetBilling)}`.replace(/[/\\?%*:|"<>]/g, '-')
    const restore = () => {
      document.title = originalTitle
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{'@media print { @page { size: A4; margin: 15mm; } }'}</style>

      {/* Toolbar */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft size={16} /> Back
        </button>
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-700">
          <Printer size={15} /> Print
        </button>
      </div>

      {/* Page */}
      <div className="max-w-3xl mx-auto bg-white shadow-sm print:shadow-none my-6 print:my-0 p-10 print:p-0 text-sm text-gray-800">
        {!company ? (
          <p className="text-center text-gray-400 py-16">No company profile selected.</p>
        ) : (
          <>
            <DocumentLetterhead company={company} />

            {/* Date */}
            <p className="mb-6">{format(new Date(), 'dd MMMM yyyy')}</p>

            {/* Client */}
            <div className="mb-6">
              <p className="font-bold">
                {dpRow?.account_type === 'Personal'
                  ? [dpRow.salutation, dpRow.first_name, dpRow.last_name].filter(Boolean).join(' ')
                  : project.owner_company_name}
              </p>
              {project.address && <p>{project.address}</p>}
            </div>

            {/* Billing No / Subject */}
            <div className="flex mb-1">
              <p className="font-bold w-24">BILLING NO</p>
              <p>: {formatBillingSerial(targetBilling)}</p>
            </div>
            {dpRow?.account_type === 'Company Owned' && (
              <div className="flex mb-1">
                <p className="font-bold w-24">THROUGH</p>
                <p>: {[dpRow.salutation, dpRow.first_name, dpRow.last_name].filter(Boolean).join(' ')}</p>
              </div>
            )}
            <div className="flex mb-6">
              <p className="font-bold w-24">SUBJECT</p>
              <p className="font-bold">: {SUBJECTS[targetBilling.billing_type]}</p>
            </div>

            <p className="mb-4">
              Dear {(dpRow?.account_type === 'Company Owned' || dpRow?.account_type === 'Personal') ? [dpRow.salutation, dpRow.last_name].filter(Boolean).join(' ') : 'Sir/Ma’am'},
            </p>
            <p className="mb-4">
              In line with our service quotation dated {project.quotation_date ? format(new Date(project.quotation_date + 'T00:00:00'), 'd MMMM yyyy') : '-'} and your subsequent approval, {bodyText}
            </p>
            <p className="mb-6">Please see below for the transaction details regarding the project:</p>

            {/* Table */}
            <table className="w-full border-collapse border border-gray-400 mb-8 text-xs">
              <thead>
                <tr className="bg-gray-100">
                  {['Contract Date', 'Scope', 'Contract Amount (Php)', 'Requested Balance (Php)', 'Remarks'].map(h => (
                    <th key={h} className="border border-gray-400 px-3 py-2 font-semibold text-gray-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cumulativeBillings.map((b, i) => (
                  <tr key={b.id}>
                    {i === 0 && (
                      <>
                        <td rowSpan={cumulativeBillings.length} className="border border-gray-400 px-3 py-2 text-center align-middle">
                          {project.quotation_date ? format(new Date(project.quotation_date + 'T00:00:00'), 'd MMMM yyyy') : '-'}
                        </td>
                        <td rowSpan={cumulativeBillings.length} className="border border-gray-400 px-3 py-2 text-center align-middle">
                          {dpRow?.scope_description || '-'}
                        </td>
                        <td rowSpan={cumulativeBillings.length} className="border border-gray-400 px-3 py-2 text-center align-middle">
                          {peso(contractCost)}
                        </td>
                      </>
                    )}
                    <td className="border border-gray-400 px-3 py-2 text-right">{peso(b.amount)}</td>
                    <td className="border border-gray-400 px-3 py-2">{remarkFor(b)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasPendingMarker && <p className="text-xs italic text-right mb-8">*Pending request</p>}

            <p className="mb-6">Thank you and hoping for your favorable response with our request.</p>
            <p className="mb-10">Sincerely,</p>

            {/* Signature */}
            <div>
              <p className="mb-2">By:</p>
              {company.signature_url ? (
                <div className="h-16 w-40 mb-1 flex items-end justify-start overflow-hidden">
                  <img src={company.signature_url} alt="Signature" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="h-16" />
              )}
              <p className="font-bold border-t border-gray-800 pt-1 inline-block min-w-[200px]">{company.default_signatory || company.company_name}</p>
              {company.signatory_position && <p>{company.signatory_position}</p>}
            </div>

            <DocumentFooter footerText={company.footer_text} />
          </>
        )}
      </div>
    </div>
  )
}
