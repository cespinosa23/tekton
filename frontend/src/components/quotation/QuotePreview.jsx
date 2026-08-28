import { format } from 'date-fns'
import { calcScopeCostTotal } from './CostTypeEditor'
import { calcBomTotal } from './BOMEditor'
import DocumentLetterhead from '../DocumentLetterhead'
import DocumentFooter from '../DocumentFooter'

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// e.g. "2P, 275V — AC Surge Protection Device" — rating/size on its own reads
// as a bare spec, so the material's type (same field shown under the name in
// the material picker) is appended when present.
const bomDescription = (row) => {
  const name = row.material_name || row.material || ''
  return row.material_type ? `${name} — ${row.material_type}` : name
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200 pb-1 mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function QuotePreview({ quote }) {
  const scopeItems = quote.scope_of_work_items || []
  // Final pricing per scope always comes from Costing (which already folds in
  // that scope's own BOM-derived Supply cost, or a manual override) — never
  // a raw BOM readout, so this must match calcAllScopeCostsTotal exactly.
  const scopeRows = scopeItems.map(t => ({
    ...t,
    cost: calcScopeCostTotal(t.costing || {}, calcBomTotal(t.bom_items || [])),
  }))
  const scopeGrandTotal = scopeRows.reduce((s, t) => s + t.cost, 0)
  const bomTypes = scopeItems.filter(t => t.bom_items?.length > 0)
  const otherItems = quote.other_items || []
  const paymentTermItems = quote.payment_term_items || []
  const hasPaymentSection = !!(paymentTermItems.length > 0 || quote.company_payment_method)

  // Section numbering is dynamic — a quote with no BOM items shouldn't leave
  // a gap ("I." then "III."), so each section only claims the next numeral
  // if it actually renders.
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']
  let sectionCount = 0
  const scopeNum = scopeRows.length > 0 ? ROMAN[sectionCount++] : null
  const bomNum = bomTypes.length > 0 ? ROMAN[sectionCount++] : null
  const notesNum = otherItems.length > 0 ? ROMAN[sectionCount++] : null
  const paymentNum = hasPaymentSection ? ROMAN[sectionCount++] : null

  let dateDisplay = ''
  if (quote.quotation_date) {
    try { dateDisplay = format(new Date(quote.quotation_date + 'T00:00:00'), 'd MMMM yyyy') } catch { dateDisplay = quote.quotation_date }
  }

  // Same convention as Billing: THROUGH only shows for Company Owned (a
  // Personal account is addressed directly, no attention line), and the
  // greeting uses just salutation + last name, never the full THROUGH name.
  const isCompanyOwned = quote.attention_account_type === 'Company Owned'
  const throughFullName = [quote.attention_salutation, quote.attention_first_name, quote.attention_last_name].filter(Boolean).join(' ')
  const greetingName = (quote.attention_account_type === 'Company Owned' || quote.attention_account_type === 'Personal')
    ? [quote.attention_salutation, quote.attention_last_name].filter(Boolean).join(' ')
    : quote.addressee_name

  // Quotation stores company fields flattened/prefixed (snapshotted at "Apply
  // Company" time) — reshape into the same company shape DocumentLetterhead
  // expects, so it's byte-for-byte the same component BillingPrint uses.
  const letterheadCompany = {
    logo_url: quote.company_logo_url,
    company_name: quote.company_name,
    short_name: quote.company_short_name,
    pcab_license: quote.company_pcab_license,
    letterhead_color: quote.company_letterhead_color,
    email: quote.company_email,
    telephone_number: quote.company_telephone_number,
    contact_number: quote.company_contact_number,
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto text-gray-800 font-sans print:shadow-none print:rounded-none">
      <DocumentLetterhead company={letterheadCompany} />

      {/* Addressee — matches the standard service-quotation letter format */}
      <div className="mb-6 text-sm text-gray-800 space-y-8">
        {dateDisplay && <p>{dateDisplay}</p>}
        <div className="space-y-2">
          <p className="font-bold uppercase">{quote.addressee_name || '—'}</p>
          {quote.addressee_address && <p>{quote.addressee_address}</p>}
        </div>
        <div>
          {isCompanyOwned && throughFullName && (
            <p><span className="inline-block w-24 font-semibold">THROUGH</span> : <span className="uppercase">{throughFullName}</span></p>
          )}
          {quote.subject && (
            <p><span className="inline-block w-24 font-semibold">SUBJECT</span> : <span className="uppercase">{quote.subject}</span></p>
          )}
        </div>
        {greetingName && <p>Dear {greetingName},</p>}
        <p>In line with your service request, we would like to submit our offer below with the following details:</p>
      </div>

      {/* Scope of Work — one row per scope type, priced from Costing (never a raw BOM readout) */}
      {scopeRows.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{scopeNum}. SCOPE OF WORKS</h3>
          <table className="w-full text-sm border border-gray-800">
            <thead>
              <tr className="text-white" style={{ backgroundColor: quote.company_letterhead_color || '#1e40af' }}>
                <th className="border border-gray-800 px-3 py-2 font-semibold text-center w-14">ITEM</th>
                <th className="border border-gray-800 px-3 py-2 font-semibold text-left">SCOPE DESCRIPTION</th>
                <th className="border border-gray-800 px-3 py-2 font-semibold text-center w-32">COST (PHP)</th>
              </tr>
            </thead>
            <tbody>
              {scopeRows.map((t, i) => (
                <tr key={t.sow_type_id}>
                  <td className="border border-gray-800 px-3 py-2 text-center align-top">{i + 1}</td>
                  <td className="border border-gray-800 px-3 py-2 align-top">
                    <p className="font-bold uppercase mb-1">{t.sow_type_name}</p>
                    {t.sub_items?.length > 0 && (
                      <ul className="space-y-1 pl-4">
                        {t.sub_items.map(si => (
                          <li key={si.item_id} className="list-disc">
                            {si.item_name}
                            {si.notes?.length > 0 && (
                              <ul className="pl-4 mt-0.5 space-y-0.5">
                                {si.notes.map((note, ni) => (
                                  <li key={ni} className="text-xs text-gray-500 list-[circle]">{note}</li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="border border-gray-800 px-3 py-2 text-center align-top whitespace-nowrap">
                    {Number(t.cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              <tr className="text-white font-bold" style={{ backgroundColor: quote.company_letterhead_color || '#1e40af' }}>
                <td colSpan={2} className="border border-gray-800 px-3 py-2 text-right">TOTAL COST</td>
                <td className="border border-gray-800 px-3 py-2 text-center whitespace-nowrap">
                  {scopeGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Bill of Materials — reference list only (quantity/unit/description), no pricing here; final pricing lives in Costing above */}
      {bomTypes.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-4">{bomNum}. BILL OF MATERIALS</h3>
          <div className="space-y-4">
            {bomTypes.map(t => (
              <div key={t.sow_type_id}>
                <p className="font-bold uppercase text-sm mb-1.5">{t.sow_type_name}</p>
                <table className="w-full text-sm border border-gray-800">
                  <thead>
                    <tr className="text-white" style={{ backgroundColor: quote.company_letterhead_color || '#1e40af' }}>
                      <th className="border border-gray-800 px-3 py-2 font-semibold text-center w-28">QUANTITY</th>
                      <th className="border border-gray-800 px-3 py-2 font-semibold text-center w-28">UNIT</th>
                      <th className="border border-gray-800 px-3 py-2 font-semibold text-left">DESCRIPTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {t.bom_items.map((row, i) => (
                      <tr key={i}>
                        <td className="border border-gray-800 px-3 py-2 text-center">{row.quantity}</td>
                        <td className="border border-gray-800 px-3 py-2 text-center">{row.unit}</td>
                        <td className="border border-gray-800 px-3 py-2">{bomDescription(row)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Solar Details */}
      {quote.template_type === 'Solar' && (
        <Section title="Solar Project Details">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['System Size', quote.system_size_kwp ? `${quote.system_size_kwp} kWp` : null],
              ['Inverter Brand', quote.inverter_brand],
              ['Battery Brand', quote.battery_brand],
              ['Panel Brand', quote.panel_brand],
              ['Estimated Monthly Savings', quote.estimated_savings ? fmt(quote.estimated_savings) : null],
              ['Return on Investment', quote.roi],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="font-semibold text-gray-900">{val}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Other Notes and Exclusions — checked items from OtherNoteTemplate */}
      {otherItems.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-2">{notesNum}. OTHER NOTES AND EXCLUSIONS</h3>
          <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1 text-justify">
            {otherItems.map((item, i) => <li key={item.item_id ?? i} className="whitespace-pre-wrap">{item.text}</li>)}
          </ul>
        </div>
      )}

      {/* Terms of Payment — checked Payment Terms items + the selected
          company's Payment Method */}
      {hasPaymentSection && (
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900 mb-2">{paymentNum}. TERMS OF PAYMENT</h3>
          {paymentTermItems.length > 0 && (
            <div className="mb-3">
              <p className="font-semibold text-sm text-gray-900 mb-1">Payment Terms</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans text-justify">{paymentTermItems[0].text}</pre>
            </div>
          )}
          {quote.company_payment_method && (
            <div>
              <p className="font-semibold text-sm text-gray-900 mb-1">Payment Method</p>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans text-justify">{quote.company_payment_method}</pre>
            </div>
          )}
        </div>
      )}

      {/* Total */}
      <div className="mt-6 text-white rounded-xl p-5 flex justify-between items-center"
        style={{ backgroundColor: quote.company_letterhead_color || '#1e40af' }}>
        <span className="text-lg font-bold">TOTAL CONTRACT COST</span>
        <span className="text-2xl font-bold">{fmt(quote.total_contract_cost)}</span>
      </div>

      {/* Signatory + Client Acceptance */}
      <div className="mt-10 pt-6 border-t border-gray-200 flex items-start justify-between gap-10">
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-2">Authorized Signatory:</p>
          {quote.signatory_signature_url ? (
            <div className="h-16 w-40 mb-1 flex items-end justify-start overflow-hidden">
              <img src={quote.signatory_signature_url} alt="Signature" className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="h-16" />
          )}
          <p className="font-bold text-gray-900 border-t border-gray-800 pt-1 inline-block min-w-[200px]">{quote.signatory_name || 'Authorized Signatory'}</p>
          {quote.signatory_title && <p className="text-sm text-gray-500">{quote.signatory_title}</p>}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900 mb-2">Client Acceptance:</p>
          <div className="h-16" />
          <p className="border-t border-gray-800 pt-1 inline-block min-w-[200px] text-xs text-gray-500">Signature over Printed Name</p>
        </div>
      </div>

      <DocumentFooter footerText={quote.company_footer} />
    </div>
  )
}
