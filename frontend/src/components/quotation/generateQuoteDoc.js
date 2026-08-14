import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType,
} from 'docx'
import { format } from 'date-fns'
import { calcScopeCostTotal } from './CostTypeEditor'
import { calcBomTotal } from './BOMEditor'

const NAVY = '1B3A5C'

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

// Converts the RichTextEditor's sanitized HTML (b/i/ul/ol/p/div/br only) into
// docx Paragraphs — ordered lists are rendered as plain "1. " prefixes rather
// than real Word numbering.xml, which keeps this simple for a short editor.
function htmlToDocxParagraphs(html) {
  if (!html) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const paragraphs = []

  function runsFromInline(node, bold = false, italics = false) {
    let runs = []
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) runs.push(new TextRun({ text: child.textContent, bold, italics }))
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toLowerCase()
        runs = runs.concat(runsFromInline(child, bold || tag === 'b' || tag === 'strong', italics || tag === 'i' || tag === 'em'))
      }
    })
    return runs
  }

  function walk(node) {
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent.trim()) paragraphs.push(ph(child.textContent))
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const tag = child.tagName.toLowerCase()
      if (tag === 'ul' || tag === 'ol') {
        Array.from(child.children).forEach((li, i) => {
          const runs = runsFromInline(li)
          const prefix = tag === 'ol' ? `${i + 1}. ` : '•  '
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: prefix }), ...runs] }))
        })
      } else if (tag === 'br') {
        paragraphs.push(blank())
      } else if (tag === 'p' || tag === 'div' || tag === 'span') {
        const runs = runsFromInline(child)
        if (runs.length) paragraphs.push(new Paragraph({ children: runs }))
      } else {
        walk(child)
      }
    })
  }

  walk(doc.body)
  return paragraphs
}

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

  // Addressee — matches the standard service-quotation letter format
  if (quote.quotation_date) {
    try {
      children.push(ph(format(new Date(quote.quotation_date + 'T00:00:00'), 'd MMMM yyyy')))
    } catch {
      children.push(ph(quote.quotation_date))
    }
  }
  children.push(blank())
  if (quote.addressee_name) children.push(ph(quote.addressee_name.toUpperCase(), { bold: true }))
  if (quote.addressee_address) children.push(ph(quote.addressee_address))
  children.push(blank())
  if (quote.attention_to) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'THROUGH', bold: true }), new TextRun({ text: `  :  ${quote.attention_to.toUpperCase()}` })],
    }))
  }
  if (quote.subject) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'SUBJECT', bold: true }), new TextRun({ text: `  :  ${quote.subject.toUpperCase()}` })],
    }))
  }
  children.push(blank())
  const greetingName = quote.attention_to || quote.addressee_name
  if (greetingName) children.push(ph(`Dear ${greetingName},`))
  children.push(ph('In line with your service request, we would like to submit our offer below with the following details:'))
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

  // Scope of Work — one row per scope type, priced from Costing (never a raw BOM readout)
  if (quote.scope_of_work_items?.length > 0) {
    children.push(ph('I. SCOPE OF WORKS', { bold: true, size: 24 }))

    const headerRow = new TableRow({
      children: ['ITEM', 'SCOPE DESCRIPTION', 'COST (PHP)'].map(h => new TableCell({
        shading: { fill: NAVY },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF' })] })],
      })),
    })

    let scopeGrandTotal = 0
    const dataRows = quote.scope_of_work_items.map((t, i) => {
      const cost = calcScopeCostTotal(t.costing || {}, calcBomTotal(t.bom_items || []))
      scopeGrandTotal += cost

      const descParagraphs = [ph(t.sow_type_name.toUpperCase(), { bold: true })]
      ;(t.sub_items || []).forEach(si => {
        descParagraphs.push(ph(`   •  ${si.item_name}`))
        ;(si.notes || []).forEach(note => descParagraphs.push(ph(`        -  ${note}`, { italics: true, size: 20 })))
      })

      return new TableRow({
        children: [
          new TableCell({ children: [ph(String(i + 1))] }),
          new TableCell({ children: descParagraphs }),
          new TableCell({ children: [ph(peso(cost))] }),
        ],
      })
    })

    const totalRow = new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          shading: { fill: NAVY },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL COST', bold: true, color: 'FFFFFF' })] })],
        }),
        new TableCell({
          shading: { fill: NAVY },
          children: [new Paragraph({ children: [new TextRun({ text: peso(scopeGrandTotal), bold: true, color: 'FFFFFF' })] })],
        }),
      ],
    })

    children.push(new Table({ rows: [headerRow, ...dataRows, totalRow], width: { size: 100, type: WidthType.PERCENTAGE } }))
    children.push(blank())
  }

  // Bill of Materials — reference list only (quantity/unit/description), no
  // pricing here; final pricing lives in Costing (the Scope of Works table above)
  const bomTypes = (quote.scope_of_work_items || []).filter(t => t.bom_items?.length > 0)
  if (bomTypes.length > 0) {
    children.push(ph('II. BILL OF MATERIALS', { bold: true, size: 24 }))
    bomTypes.forEach(t => {
      children.push(ph(t.sow_type_name.toUpperCase(), { bold: true }))
      const headerRow = new TableRow({
        children: ['QUANTITY', 'UNIT', 'DESCRIPTION'].map(h => new TableCell({
          shading: { fill: NAVY },
          children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF' })] })],
        })),
      })
      const dataRows = t.bom_items.map(item => new TableRow({
        children: [
          new TableCell({ children: [ph(String(item.quantity ?? ''))] }),
          new TableCell({ children: [ph(item.unit || '')] }),
          new TableCell({ children: [ph(item.material_name || item.material || '')] }),
        ],
      }))
      children.push(new Table({ rows: [headerRow, ...dataRows], width: { size: 100, type: WidthType.PERCENTAGE } }))
      children.push(blank())
    })
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

  // Other Notes and Exclusions (rich text)
  if (quote.notes_and_exclusions) {
    children.push(sectionTitle('OTHER NOTES AND EXCLUSIONS'))
    children.push(...htmlToDocxParagraphs(quote.notes_and_exclusions))
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
