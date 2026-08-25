import { format } from 'date-fns'
import { calcScopeCostTotal } from '../../components/quotation/CostTypeEditor'
import { calcBomTotal } from '../../components/quotation/BOMEditor'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

// e.g. "2P, 275V — AC Surge Protection Device" — rating/size on its own reads
// as a bare spec, so the material's type (same field shown under the name in
// the material picker) is appended when present.
function bomDescription(item) {
  const name = item.material_name || item.material || ''
  return item.material_type ? `${name} — ${item.material_type}` : name
}

// Turns a Quotation record into the shared document IR (see ir.js for the
// shape) — the single source of truth both toDocx() and toPdf() render from,
// so the two output formats can never drift apart the way hand-written
// duplicate layouts did before.
export function buildQuotationIR(quote) {
  const blocks = []

  let dateDisplay = ''
  if (quote.quotation_date) {
    try { dateDisplay = format(new Date(quote.quotation_date + 'T00:00:00'), 'd MMMM yyyy') } catch { dateDisplay = quote.quotation_date }
  }
  if (dateDisplay) blocks.push({ type: 'date', text: dateDisplay })

  blocks.push({ type: 'addressBlock', name: quote.addressee_name || '', address: quote.addressee_address || '' })

  // Same convention as Billing: THROUGH only shows for Company Owned (a
  // Personal account is addressed directly, no attention line), and the
  // greeting uses just salutation + last name, never the full THROUGH name.
  const isCompanyOwned = quote.attention_account_type === 'Company Owned'
  const throughFullName = [quote.attention_salutation, quote.attention_first_name, quote.attention_last_name].filter(Boolean).join(' ')
  if (isCompanyOwned && throughFullName) blocks.push({ type: 'labelValue', label: 'THROUGH', value: throughFullName.toUpperCase() })
  if (quote.subject) blocks.push({ type: 'labelValue', label: 'SUBJECT', value: quote.subject.toUpperCase() })

  const greetingName = (quote.attention_account_type === 'Company Owned' || quote.attention_account_type === 'Personal')
    ? [quote.attention_salutation, quote.attention_last_name].filter(Boolean).join(' ')
    : quote.addressee_name
  if (greetingName) blocks.push({ type: 'paragraph', text: `Dear ${greetingName},` })
  blocks.push({ type: 'paragraph', text: 'In line with your service request, we would like to submit our offer below with the following details:' })

  if (quote.template_type === 'Solar') {
    blocks.push({
      type: 'keyValueBlock',
      title: 'SOLAR PROJECT DETAILS',
      rows: [
        ['System Size (kWp)', quote.system_size_kwp ? `${quote.system_size_kwp} kWp` : '-'],
        ['Inverter Brand', quote.inverter_brand || '-'],
        ['Battery Brand', quote.battery_brand || '-'],
        ['Panel Brand', quote.panel_brand || '-'],
        ['Project Cost', quote.project_cost ? peso(quote.project_cost) : '-'],
        ['Est. Monthly Savings', quote.estimated_savings ? peso(quote.estimated_savings) : '-'],
        ['Return on Investment', quote.roi || '-'],
      ],
    })
  }

  // Section numbering is dynamic — a quote with no BOM items shouldn't leave
  // a numbering gap ("I." then "III."), so each section only claims the next
  // numeral if it actually renders.
  const scopeItems = quote.scope_of_work_items || []
  const bomTypes = scopeItems.filter(t => t.bom_items?.length > 0)
  const paymentTermItems = quote.payment_term_items || []
  const hasPaymentSection = !!(paymentTermItems.length > 0 || quote.company_payment_method)
  let sectionCount = 0
  const scopeNum = scopeItems.length > 0 ? ROMAN[sectionCount++] : null
  const bomNum = bomTypes.length > 0 ? ROMAN[sectionCount++] : null
  const otherItems = quote.other_items || []
  const notesNum = otherItems.length > 0 ? ROMAN[sectionCount++] : null
  const paymentNum = hasPaymentSection ? ROMAN[sectionCount++] : null

  // I. Scope of Works — final pricing always comes from Costing (which
  // already folds in that scope's own BOM-derived Supply cost, or a manual
  // override) — never a raw BOM readout.
  if (scopeItems.length > 0) {
    let scopeGrandTotal = 0
    const rows = scopeItems.map((t, i) => {
      const cost = calcScopeCostTotal(t.costing || {}, calcBomTotal(t.bom_items || []))
      scopeGrandTotal += cost
      return [
        String(i + 1),
        {
          heading: (t.sow_type_name || '').toUpperCase(),
          bullets: (t.sub_items || []).map(si => ({ text: si.item_name, subBullets: si.notes || [] })),
        },
        num(cost),
      ]
    })
    blocks.push({
      type: 'section',
      number: scopeNum,
      title: 'SCOPE OF WORKS',
      content: {
        kind: 'table',
        columns: [{ header: 'ITEM', width: 8 }, { header: 'SCOPE DESCRIPTION', width: 72 }, { header: 'COST (PHP)', width: 20 }],
        rows,
        totalRow: ['TOTAL COST', num(scopeGrandTotal)],
      },
    })
  }

  // II. Bill of Materials — reference list only (quantity/unit/description),
  // no pricing here; final pricing lives in the Scope of Works table above.
  if (bomTypes.length > 0) {
    blocks.push({
      type: 'section',
      number: bomNum,
      title: 'BILL OF MATERIALS',
      content: {
        kind: 'tableGroup',
        groups: bomTypes.map(t => ({
          heading: (t.sow_type_name || '').toUpperCase(),
          table: {
            columns: [{ header: 'QUANTITY', width: 22 }, { header: 'UNIT', width: 22 }, { header: 'DESCRIPTION', width: 56 }],
            rows: t.bom_items.map(item => [String(item.quantity ?? ''), item.unit || '', bomDescription(item)]),
          },
        })),
      },
    })
  }

  // III. Other Notes and Exclusions — checked items from OtherNoteTemplate
  if (otherItems.length > 0) {
    blocks.push({
      type: 'section',
      number: notesNum,
      title: 'OTHER NOTES AND EXCLUSIONS',
      content: { kind: 'bulletList', items: otherItems.map(i => i.text) },
    })
  }

  // IV. Terms of Payment — checked Payment Terms items + the selected
  // company's Payment Method, printed exactly as typed
  if (hasPaymentSection) {
    const paymentBlocks = []
    if (paymentTermItems.length > 0) paymentBlocks.push({ label: 'Payment Terms', kind: 'bulletList', items: paymentTermItems.map(i => i.text) })
    if (quote.company_payment_method) paymentBlocks.push({ label: 'Payment Method', kind: 'text', text: quote.company_payment_method })
    blocks.push({
      type: 'section',
      number: paymentNum,
      title: 'TERMS OF PAYMENT',
      content: { kind: 'labeledBlocks', blocks: paymentBlocks },
    })
  }

  blocks.push({ type: 'totalBanner', label: 'TOTAL CONTRACT COST', amount: quote.total_contract_cost })

  blocks.push({
    type: 'signatureBlock',
    signatory: {
      imageUrl: quote.signatory_signature_url || null,
      name: quote.signatory_name || 'Authorized Signatory',
      title: quote.signatory_title || '',
    },
    counterSignature: { label: 'Client Acceptance:', caption: 'Signature over Printed Name' },
  })

  return {
    letterhead: {
      logoUrl: quote.company_logo_url || null,
      companyName: quote.company_name || '',
      shortName: quote.company_short_name || '',
      pcabLicense: quote.company_pcab_license || '',
      letterheadColor: quote.company_letterhead_color || '',
      email: quote.company_email || '',
      telephoneNumber: quote.company_telephone_number || '',
      contactNumber: quote.company_contact_number || '',
    },
    blocks,
    footerText: quote.company_footer || '',
  }
}

function peso(n) {
  return `₱${num(n)}`
}

function num(n) {
  return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
