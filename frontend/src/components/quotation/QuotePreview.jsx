import { format } from 'date-fns'

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
  const bomTotal = (quote.bill_of_materials || []).reduce((s, i) => s + (i.subtotal || 0), 0)
  const otherTotal = (quote.other_scope_costs || []).reduce((s, i) => s + (Number(i.amount) || 0), 0)

  let dateDisplay = ''
  if (quote.quotation_date) {
    try { dateDisplay = format(new Date(quote.quotation_date + 'T00:00:00'), 'MMMM d, yyyy') } catch { dateDisplay = quote.quotation_date }
  }

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
          {dateDisplay && <p className="text-sm text-gray-500">{dateDisplay}</p>}
        </div>
      </div>

      {/* Addressee */}
      <Section title="Addressed To">
        <p className="font-semibold text-gray-900">{quote.addressee_name || '—'}</p>
        {quote.addressee_address && <p className="text-sm text-gray-600 mt-0.5">{quote.addressee_address}</p>}
        {quote.subject && (
          <p className="mt-2 font-medium text-gray-700"><span className="text-gray-500">RE: </span>{quote.subject}</p>
        )}
      </Section>

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

      {/* Scope of Works */}
      {quote.scope_of_works && (
        <Section title="Scope of Works">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{quote.scope_of_works}</pre>
        </Section>
      )}

      {/* Bill of Materials */}
      {quote.bill_of_materials?.length > 0 && (
        <Section title="Bill of Materials">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  {['Material', 'Qty', 'Unit', 'Unit Price', 'Markup %', 'Adj. Unit Price', 'Subtotal'].map(h => (
                    <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quote.bill_of_materials.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2">{row.material}</td>
                    <td className="px-3 py-2">{row.quantity}</td>
                    <td className="px-3 py-2">{row.unit}</td>
                    <td className="px-3 py-2">{fmt(row.unit_price)}</td>
                    <td className="px-3 py-2">{row.markup_pct}%</td>
                    <td className="px-3 py-2">{fmt(row.adjusted_unit_price)}</td>
                    <td className="px-3 py-2 font-semibold">{fmt(row.subtotal)}</td>
                  </tr>
                ))}
                <tr className="bg-amber-50 font-bold">
                  <td colSpan={6} className="px-3 py-2 text-right text-gray-700">BOM Total:</td>
                  <td className="px-3 py-2 text-amber-700">{fmt(bomTotal)}</td>
                </tr>
              </tbody>
            </table>
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

      {/* Notes & Exclusions */}
      {quote.notes && (
        <Section title="Notes">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{quote.notes}</pre>
        </Section>
      )}
      {quote.exclusions && (
        <Section title="Exclusions">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{quote.exclusions}</pre>
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
        <div className="mt-8 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
          {quote.company_footer}
        </div>
      )}
    </div>
  )
}
