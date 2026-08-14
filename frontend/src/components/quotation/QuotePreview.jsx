import { format } from 'date-fns'
import { calcScopeCostTotal } from './CostTypeEditor'
import { calcBomTotal } from './BOMEditor'
import { sanitizeRichText } from '../RichTextEditor'

const fmt = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
  const otherTotal = (quote.other_scope_costs || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)

  let dateDisplay = ''
  if (quote.quotation_date) {
    try { dateDisplay = format(new Date(quote.quotation_date + 'T00:00:00'), 'd MMMM yyyy') } catch { dateDisplay = quote.quotation_date }
  }

  const greetingName = quote.attention_to || quote.addressee_name

  return (
    <div className="bg-white rounded-xl shadow-lg p-8 max-w-4xl mx-auto text-gray-800 font-sans print:shadow-none print:rounded-none">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-gray-200">
        <div>
          {quote.company_logo_url && (
            <img src={quote.company_logo_url} alt="logo" className="h-14 mb-3 object-contain" onError={e => { e.target.style.display = 'none' }} />
          )}
          <h1 className="text-2xl font-bold text-gray-900">{quote.company_name || 'Company Name'}</h1>
          {quote.company_address && <p className="text-sm text-gray-500 mt-1">{quote.company_address}</p>}
          {quote.company_contact && <p className="text-sm text-gray-500">{quote.company_contact}</p>}
        </div>
        <div className="text-right">
          <div className="inline-block bg-amber-500 text-white font-bold text-xl px-6 py-2 rounded-lg">QUOTATION</div>
          {quote.quote_number && <p className="text-sm text-gray-500 mt-2">#{quote.quote_number}</p>}
        </div>
      </div>

      {/* Addressee — matches the standard service-quotation letter format */}
      <div className="mb-6 text-sm text-gray-800 space-y-4">
        {dateDisplay && <p>{dateDisplay}</p>}
        <div>
          <p className="font-bold uppercase">{quote.addressee_name || '—'}</p>
          {quote.addressee_address && <p>{quote.addressee_address}</p>}
        </div>
        <div>
          {quote.attention_to && (
            <p><span className="inline-block w-24 font-semibold">THROUGH</span> : <span className="uppercase">{quote.attention_to}</span></p>
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
          <h3 className="text-sm font-bold text-gray-900 mb-2">I. SCOPE OF WORKS</h3>
          <table className="w-full text-sm border border-gray-800">
            <thead>
              <tr className="bg-[#1b3a5c] text-white">
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
              <tr className="bg-[#1b3a5c] text-white font-bold">
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
          <h3 className="text-sm font-bold text-gray-900 mb-2">II. BILL OF MATERIALS</h3>
          <div className="space-y-4">
            {bomTypes.map(t => (
              <div key={t.sow_type_id}>
                <p className="font-bold uppercase text-sm mb-1.5">{t.sow_type_name}</p>
                <table className="w-full text-sm border border-gray-800">
                  <thead>
                    <tr className="bg-[#1b3a5c] text-white">
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
                        <td className="border border-gray-800 px-3 py-2">{row.material_name || row.material}</td>
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

      {/* Other Scope Costs */}
      {quote.other_scope_costs?.length > 0 && (
        <Section title="Other Scope Costs">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {quote.other_scope_costs.map((row, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-2">{row.description}</td>
                  <td className="px-3 py-2 text-right">{fmt(row.amount)}</td>
                </tr>
              ))}
              <tr className="bg-amber-50 font-bold">
                <td className="px-3 py-2 text-right text-gray-700">Total:</td>
                <td className="px-3 py-2 text-right text-amber-700">{fmt(otherTotal)}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}

      {/* Payment */}
      {quote.terms_of_payment && (
        <Section title="Terms of Payment">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{quote.terms_of_payment}</pre>
        </Section>
      )}
      {quote.mode_of_payment && (
        <Section title="Mode of Payment">
          <p className="text-sm text-gray-700">{quote.mode_of_payment}</p>
        </Section>
      )}

      {/* Other Notes and Exclusions (rich text) */}
      {quote.notes_and_exclusions && (
        <Section title="Other Notes and Exclusions">
          <div className="text-sm text-gray-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(quote.notes_and_exclusions) }} />
        </Section>
      )}

      {/* Total */}
      <div className="mt-6 bg-amber-500 text-white rounded-xl p-5 flex justify-between items-center">
        <span className="text-lg font-bold">TOTAL CONTRACT COST</span>
        <span className="text-2xl font-bold">{fmt(quote.total_contract_cost)}</span>
      </div>

      {/* Signatory */}
      <div className="mt-10 pt-6 border-t border-gray-200">
        <div className="mt-12 inline-block border-t-2 border-gray-800 pt-1 w-48">
          <p className="font-bold text-gray-900">{quote.signatory_name || 'Authorized Signatory'}</p>
          {quote.signatory_title && <p className="text-sm text-gray-500">{quote.signatory_title}</p>}
          {quote.company_name && <p className="text-sm text-gray-500">{quote.company_name}</p>}
        </div>
      </div>

      {/* Footer */}
      {quote.company_footer && (
        <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400 whitespace-pre-line">
          {quote.company_footer}
        </div>
      )}
    </div>
  )
}
