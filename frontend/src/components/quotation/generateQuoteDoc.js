import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, ImageRun, BorderStyle,
} from 'docx'
import { format } from 'date-fns'
import { calcScopeCostTotal } from './CostTypeEditor'
import { calcBomTotal } from './BOMEditor'

const NAVY = '1B3A5C'
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }

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

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`
const hexColor = (c) => (c || '#1e40af').replace('#', '').toUpperCase()

// Company/signature images are stored as base64 data-URIs — decode to the
// raw bytes ImageRun needs, and infer its type from the data-URI's mime.
function dataUriToImage(dataUri) {
  if (!dataUri || !dataUri.startsWith('data:')) return null
  const match = dataUri.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) return null
  const [, mime, base64] = match
  const type = mime === 'jpg' ? 'jpeg' : mime
  if (!['png', 'jpeg', 'gif', 'bmp'].includes(type)) return null
  try {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return { data: bytes, type }
  } catch {
    return null
  }
}

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

  // Header — same letterhead as BillingPrint: logo/name/short name/PCAB on the
  // left, email/telephone/cellphone on the right, as a borderless 2-col table.
  const letterColor = hexColor(quote.company_letterhead_color)
  const logoImage = dataUriToImage(quote.company_logo_url)

  const leftParagraphs = []
  if (logoImage) {
    leftParagraphs.push(new Paragraph({
      children: [new ImageRun({ data: logoImage.data, type: logoImage.type, transformation: { width: 56, height: 56 } })],
    }))
  }
  if (quote.company_name) leftParagraphs.push(ph(quote.company_name.toUpperCase(), { bold: true, size: 32, color: letterColor }))
  if (quote.company_short_name) leftParagraphs.push(ph(quote.company_short_name, { bold: true, size: 24, color: letterColor }))
  if (quote.company_pcab_license) leftParagraphs.push(ph(`PCAB License: ${quote.company_pcab_license}`, { size: 14, color: letterColor }))
  if (leftParagraphs.length === 0) leftParagraphs.push(blank())

  const phRight = (text = '', opts = {}) =>
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(text), ...opts })] })

  const rightParagraphs = []
  if (quote.company_email) rightParagraphs.push(phRight(quote.company_email, { size: 16 }))
  ;(quote.company_telephone_number || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(line => rightParagraphs.push(phRight(line, { size: 16 })))
  ;(quote.company_contact_number || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(line => rightParagraphs.push(phRight(line, { size: 16 })))
  if (rightParagraphs.length === 0) rightParagraphs.push(blank())

  children.push(new Table({
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        new TableCell({ borders: NO_BORDERS, width: { size: 65, type: WidthType.PERCENTAGE }, children: leftParagraphs }),
        new TableCell({ borders: NO_BORDERS, width: { size: 35, type: WidthType.PERCENTAGE }, children: rightParagraphs }),
      ],
    })],
  }))
  children.push(blank())

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

  // Section numbering is dynamic — a quote with no BOM items shouldn't leave
  // a gap ("I." then "III."), so each section only claims the next numeral
  // if it actually renders. Must match QuotePreview's logic exactly.
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']
  const bomTypesForNumbering = (quote.scope_of_work_items || []).filter(t => t.bom_items?.length > 0)
  const hasPaymentSection = !!(quote.terms_of_payment || quote.mode_of_payment)
  let sectionCount = 0
  const scopeNum = quote.scope_of_work_items?.length > 0 ? ROMAN[sectionCount++] : null
  const bomNum = bomTypesForNumbering.length > 0 ? ROMAN[sectionCount++] : null
  const notesNum = quote.notes_and_exclusions ? ROMAN[sectionCount++] : null
  const paymentNum = hasPaymentSection ? ROMAN[sectionCount++] : null

  // Scope of Work — one row per scope type, priced from Costing (never a raw BOM readout)
  if (quote.scope_of_work_items?.length > 0) {
    children.push(ph(`${scopeNum}. SCOPE OF WORKS`, { bold: true, size: 24 }))

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
  const bomTypes = bomTypesForNumbering
  if (bomTypes.length > 0) {
    children.push(ph(`${bomNum}. BILL OF MATERIALS`, { bold: true, size: 24 }))
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

  // Other Notes and Exclusions (rich text)
  if (quote.notes_and_exclusions) {
    children.push(ph(`${notesNum}. OTHER NOTES AND EXCLUSIONS`, { bold: true, size: 24 }))
    children.push(...htmlToDocxParagraphs(quote.notes_and_exclusions))
    children.push(blank())
  }

  // Terms of Payment — Payment Terms + Payment Method, as one numbered section
  if (hasPaymentSection) {
    children.push(ph(`${paymentNum}. TERMS OF PAYMENT`, { bold: true, size: 24 }))
    if (quote.terms_of_payment) {
      children.push(ph('Payment Terms', { bold: true }))
      quote.terms_of_payment.split('\n').forEach(line => children.push(ph(line)))
      children.push(blank())
    }
    if (quote.mode_of_payment) {
      children.push(ph('Payment Method', { bold: true }))
      quote.mode_of_payment.split('\n').forEach(line => children.push(ph(line)))
      children.push(blank())
    }
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

  // Signatory + Client Acceptance
  children.push(blank())
  const sigImage = dataUriToImage(quote.signatory_signature_url)
  const signatoryParagraphs = [ph('Authorized Signatory:', { bold: true })]
  if (sigImage) {
    signatoryParagraphs.push(new Paragraph({
      children: [new ImageRun({ data: sigImage.data, type: sigImage.type, transformation: { width: 100, height: 45 } })],
    }))
  } else {
    signatoryParagraphs.push(blank())
  }
  signatoryParagraphs.push(ph(quote.signatory_name || 'Authorized Signatory', { bold: true }))
  if (quote.signatory_title) signatoryParagraphs.push(ph(quote.signatory_title))

  const acceptanceParagraphs = [
    ph('Client Acceptance:', { bold: true }),
    blank(),
    ph('Signature over Printed Name', { size: 16 }),
  ]

  children.push(new Table({
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({
      children: [
        new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: signatoryParagraphs }),
        new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: acceptanceParagraphs }),
      ],
    })],
  }))

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
