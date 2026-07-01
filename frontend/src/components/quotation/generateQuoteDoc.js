import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType,
} from 'docx'
import { format } from 'date-fns'

function ph(text = '', opts = {}) {
  return new Paragraph({ children: [new TextRun({ text: String(text), ...opts })] })
}

function blank() {
  return new Paragraph({ text: '' })
}

function sectionTitle(text) {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, underline: {} })],
    spacing: { before: 240, after: 120 },
  })
}

function makeTable(headers, rows) {
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({ children: [ph(h, { bold: true })] })),
  })
  const dataRows = rows.map(cells =>
    new TableRow({ children: cells.map(c => new TableCell({ children: [ph(c)] })) })
  )
  return new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } })
}

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`

export async function downloadQuoteAsDocx(quote) {
  const children = []

  // Header
  if (quote.company_name) children.push(ph(quote.company_name, { bold: true, size: 32 }))
  if (quote.company_address) children.push(ph(quote.company_address))
  if (quote.company_contact) children.push(ph(quote.company_contact))
  children.push(blank())

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: 'QUOTATION', bold: true, size: 36, underline: {} })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  }))

  // Addressee
  if (quote.addressee_name) children.push(ph(`To: ${quote.addressee_name}`, { bold: true }))
  if (quote.addressee_address) children.push(ph(quote.addressee_address))
  children.push(blank())
  if (quote.subject) children.push(ph(`RE: ${quote.subject}`, { bold: true }))
  if (quote.quotation_date) {
    try {
      children.push(ph(`Date: ${format(new Date(quote.quotation_date + 'T00:00:00'), 'MMMM d, yyyy')}`))
    } catch {
      children.push(ph(`Date: ${quote.quotation_date}`))
    }
  }
  children.push(blank())

  // Solar Details
  if (quote.template_type === 'Solar') {
    children.push(sectionTitle('SOLAR PROJECT DETAILS'))
    const rows = [
      ['System Size (kWp)', quote.system_size_kwp ? `${quote.system_size_kwp} kWp` : '-'],
      ['Inverter Brand', quote.inverter_brand || '-'],
      ['Battery Brand', quote.battery_brand || '-'],
      ['Panel Brand', quote.panel_brand || '-'],
      ['Project Cost', quote.project_cost ? peso(quote.project_cost) : '-'],
      ['Est. Monthly Savings', quote.estimated_savings ? peso(quote.estimated_savings) : '-'],
      ['Return on Investment', quote.roi || '-'],
    ]
    rows.forEach(([label, val]) =>
      children.push(new Paragraph({
        children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: val })],
      }))
    )
    children.push(blank())
  }

  // Scope of Works
  if (quote.scope_of_works) {
    children.push(sectionTitle('SCOPE OF WORKS'))
    quote.scope_of_works.split('\n').forEach(line => children.push(ph(line)))
    children.push(blank())
  }

  // Bill of Materials
  if (quote.bill_of_materials?.length > 0) {
    children.push(sectionTitle('BILL OF MATERIALS'))
    const headers = ['Material', 'Qty', 'Unit', 'Unit Price', 'Markup %', 'Adj. Unit Price', 'Subtotal']
    const bomRows = quote.bill_of_materials.map(item => [
      item.material || '',
      String(item.quantity || 0),
      item.unit || '',
      peso(item.unit_price),
      `${item.markup_pct || 0}%`,
      peso(item.adjusted_unit_price),
      peso(item.subtotal),
    ])
    const bomTotal = quote.bill_of_materials.reduce((s, i) => s + (i.subtotal || 0), 0)
    bomRows.push(['TOTAL', '', '', '', '', '', peso(bomTotal)])
    children.push(makeTable(headers, bomRows))
    children.push(blank())
  }

  // Other Scope Costs
  if (quote.other_scope_costs?.length > 0) {
    children.push(sectionTitle('OTHER SCOPE COSTS'))
    const otherRows = quote.other_scope_costs.map(item => [item.description || '', peso(item.amount)])
    const otherTotal = quote.other_scope_costs.reduce((s, i) => s + (i.amount || 0), 0)
    otherRows.push(['TOTAL', peso(otherTotal)])
    children.push(makeTable(['Description', 'Amount'], otherRows))
    children.push(blank())
  }

  // Terms of Payment
  if (quote.terms_of_payment) {
    children.push(sectionTitle('TERMS OF PAYMENT'))
    quote.terms_of_payment.split('\n').forEach(line => children.push(ph(line)))
    children.push(blank())
  }

  // Mode of Payment
  if (quote.mode_of_payment) {
    children.push(sectionTitle('MODE OF PAYMENT'))
    children.push(ph(quote.mode_of_payment))
    children.push(blank())
  }

  // Notes
  if (quote.notes) {
    children.push(sectionTitle('NOTES'))
    quote.notes.split('\n').forEach(line => children.push(ph(line)))
    children.push(blank())
  }

  // Exclusions
  if (quote.exclusions) {
    children.push(sectionTitle('EXCLUSIONS'))
    quote.exclusions.split('\n').forEach(line => children.push(ph(line)))
    children.push(blank())
  }

  // Total
  children.push(new Paragraph({
    children: [
      new TextRun({ text: 'TOTAL CONTRACT COST: ', bold: true, size: 26 }),
      new TextRun({ text: peso(quote.total_contract_cost), bold: true, size: 26 }),
    ],
    spacing: { before: 200 },
  }))
  children.push(blank())

  // Signatory
  children.push(blank())
  children.push(blank())
  if (quote.signatory_name) children.push(ph(quote.signatory_name, { bold: true }))
  if (quote.signatory_title) children.push(ph(quote.signatory_title))
  if (quote.company_name) children.push(ph(quote.company_name))

  // Footer
  if (quote.company_footer) {
    children.push(blank())
    children.push(new Paragraph({
      children: [new TextRun({ text: quote.company_footer, size: 18, color: '666666' })],
      alignment: AlignmentType.CENTER,
    }))
  }

  const doc = new Document({ sections: [{ properties: {}, children }] })
  const blob = await Packer.toBlob(doc)

  const clientName = (quote.addressee_name || 'Client').replace(/\s+/g, '')
  let dateStr = 'Today'
  try { dateStr = format(new Date(), 'MMMdd_yyyy') } catch {}
  const fileName = `Quotation_${clientName}_${dateStr}.docx`

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
