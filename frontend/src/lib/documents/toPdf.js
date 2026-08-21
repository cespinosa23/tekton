import pdfMake from './pdfSetup'
import { formatPhoneLines } from '../../utils/phoneFormat'
import { normalizeImageForPdf } from './normalizeImage'

const NAVY = '#1B3A5C'
const CONTENT_WIDTH = 532 // Legal (612pt) minus default 40pt left/right margins

const TABLE_LAYOUT = {
  hLineColor: () => '#333333',
  vLineColor: () => '#333333',
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  paddingLeft: () => 6,
  paddingRight: () => 6,
  paddingTop: () => 4,
  paddingBottom: () => 4,
}

const peso = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Same path data as lucide-react's Mail/Phone/Smartphone icons (already used
// everywhere else in the app) — pdfmake can't render React icon components,
// but it can render raw SVG, so the letterhead uses the exact same glyphs.
const ICON_ATTRS = 'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const ICONS = {
  mail: `<svg ${ICON_ATTRS}><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>`,
  phone: `<svg ${ICON_ATTRS}><path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384"/></svg>`,
  smartphone: `<svg ${ICON_ATTRS}><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>`,
}

// One icon + text row, left-aligned within the letterhead's right-hand
// column (icon then text) — matches the HTML letterhead's
// `flex items-center justify-start gap-1.5` rows, not right-aligned to the
// page edge.
function iconLine(icon, text) {
  return {
    columns: [
      { svg: ICONS[icon], width: 9, height: 9 },
      { text, fontSize: 9, color: '#4b5563', margin: [4.5, 0, 0, 0], width: 'auto' },
    ],
    columnGap: 0,
    margin: [0, 0, 0, 3],
  }
}

function hLine(width = 160) {
  return { canvas: [{ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineWidth: 1, lineColor: '#1f2937' }], margin: [0, 2, 0, 4] }
}

// Converts RichTextEditor's sanitized HTML (b/i/ul/ol/p/div/br only) into
// pdfmake content nodes.
function htmlToPdfContent(html) {
  if (!html) return []
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const content = []

  function runsFromInline(node, bold = false, italics = false) {
    let runs = []
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent) runs.push({ text: child.textContent, ...(bold ? { bold: true } : {}), ...(italics ? { italics: true } : {}) })
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
        if (child.textContent.trim()) content.push({ text: child.textContent })
        return
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const tag = child.tagName.toLowerCase()
      if (tag === 'ul' || tag === 'ol') {
        const items = Array.from(child.children).map(li => ({ text: runsFromInline(li) }))
        content.push(tag === 'ol' ? { ol: items } : { ul: items })
      } else if (tag === 'br') {
        content.push({ text: ' ' })
      } else if (tag === 'p' || tag === 'div' || tag === 'span') {
        const runs = runsFromInline(child)
        if (runs.length) content.push({ text: runs })
      } else {
        walk(child)
      }
    })
  }

  walk(doc.body)
  return content
}

function renderLetterhead(letterhead) {
  const color = letterhead.letterheadColor || '#1e40af'
  const left = []
  if (letterhead.logoUrl) left.push({ image: letterhead.logoUrl, width: 48, height: 48, margin: [0, 0, 0, 4] })
  if (letterhead.companyName) left.push({ text: letterhead.companyName.toUpperCase(), bold: true, fontSize: 18, color })
  if (letterhead.shortName) left.push({ text: letterhead.shortName, fontSize: 13.5, color })
  if (letterhead.pcabLicense) left.push({ text: `PCAB License: ${letterhead.pcabLicense}`, fontSize: 7.5, color })

  const right = []
  if (letterhead.email) right.push(iconLine('mail', letterhead.email))
  formatPhoneLines(letterhead.telephoneNumber).forEach(line => right.push(iconLine('phone', line)))
  formatPhoneLines(letterhead.contactNumber).forEach(line => right.push(iconLine('smartphone', line)))

  return [
    {
      // Right block is 'auto'-width (sized to its own content) after a '*'
      // spacer, so it hugs the page's right margin exactly like the HTML
      // letterhead's `flex justify-between` + `flex-shrink-0` — not a fixed
      // percentage column with leftover empty space past the text.
      columns: [
        { width: '60%', stack: left.length ? left : [{ text: '' }] },
        { width: '*', text: '' },
        { width: 'auto', stack: right.length ? right : [{ text: '' }] },
      ],
    },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 1.5, lineColor: '#1f2937' }], margin: [0, 8, 0, 14] },
  ]
}

function renderCellContent(cell) {
  if (cell && typeof cell === 'object' && 'heading' in cell) {
    const items = (cell.bullets || []).map(b => {
      const item = { text: b.text }
      if (b.subBullets?.length) item.ul = b.subBullets.map(note => ({ text: note, fontSize: 7, italics: true, color: '#6b7280' }))
      return item
    })
    return { stack: [{ text: cell.heading, bold: true, margin: [0, 0, 0, items.length ? 3 : 0] }, ...(items.length ? [{ ul: items }] : [])] }
  }
  return { text: String(cell ?? '') }
}

function renderTable(table) {
  const widths = table.columns.map(c => `${c.width}%`)
  const body = [table.columns.map(c => ({ text: c.header, bold: true, color: 'white', fillColor: NAVY }))]
  table.rows.forEach(row => body.push(row.map(renderCellContent)))
  if (table.totalRow) {
    const [label, amount] = table.totalRow
    const span = table.columns.length - 1
    const row = [{ text: label, bold: true, color: 'white', fillColor: NAVY, colSpan: span, alignment: 'right' }]
    for (let i = 1; i < span; i++) row.push({})
    row.push({ text: amount, bold: true, color: 'white', fillColor: NAVY })
    body.push(row)
  }
  // dontBreakRows — without it, pdfmake can split a single row's cell content
  // across a page boundary (e.g. a BOM row showing its quantity on one page
  // and its description on the next). Force the whole row to move to the
  // next page together instead.
  return { table: { headerRows: 1, widths, body, dontBreakRows: true, keepWithHeaderRows: 1 }, layout: TABLE_LAYOUT }
}

function renderSectionContent(content) {
  if (content.kind === 'table') return [renderTable(content)]
  if (content.kind === 'tableGroup') {
    const out = []
    content.groups.forEach(g => {
      out.push({ text: g.heading, bold: true, margin: [0, 6, 0, 4] })
      out.push(renderTable(g.table))
    })
    return out
  }
  if (content.kind === 'richTextHtml') return htmlToPdfContent(content.html)
  if (content.kind === 'bulletList') return [{ ul: content.items.map(text => ({ text })) }]
  if (content.kind === 'labeledBlocks') {
    const out = []
    content.blocks.forEach(b => {
      out.push({ text: b.label, bold: true, margin: [0, 6, 0, 2] })
      if (b.kind === 'bulletList') {
        out.push({ ul: b.items.map(text => ({ text })) })
      } else {
        b.text.split('\n').forEach(line => out.push({ text: line || ' ' }))
      }
    })
    return out
  }
  return []
}

function renderBlock(block) {
  switch (block.type) {
    case 'date':
      return [{ text: block.text, margin: [0, 0, 0, 20] }]
    case 'addressBlock': {
      const out = []
      if (block.name) out.push({ text: block.name.toUpperCase(), bold: true, margin: [0, 0, 0, block.address ? 8 : 0] })
      if (block.address) out.push({ text: block.address })
      out.push({ text: ' ', margin: [0, 0, 0, 8] })
      return out
    }
    case 'labelValue':
      return [{ columns: [{ text: block.label, bold: true, width: 80 }, { text: `:  ${block.value}` }], margin: [0, 0, 0, 2] }]
    case 'paragraph':
      return [{ text: block.text, margin: [0, 0, 0, 10] }]
    case 'keyValueBlock': {
      const out = [{ text: block.title, bold: true, fontSize: 12, decoration: 'underline', margin: [0, 10, 0, 6] }]
      block.rows.forEach(([label, val]) => out.push({ text: [{ text: `${label}: `, bold: true }, { text: val }] }))
      out.push({ text: ' ', margin: [0, 0, 0, 10] })
      return out
    }
    case 'section':
      return [
        { text: `${block.number}. ${block.title}`, bold: true, fontSize: 12, margin: [0, 10, 0, 6] },
        ...renderSectionContent(block.content),
        { text: ' ', margin: [0, 0, 0, 10] },
      ]
    case 'totalBanner':
      return [{
        table: {
          widths: ['*', 'auto'],
          dontBreakRows: true,
          body: [[
            { text: block.label, bold: true, fontSize: 13.5, color: 'white', fillColor: '#f59e0b', margin: [10, 10, 8, 10] },
            { text: peso(block.amount), bold: true, fontSize: 18, color: 'white', fillColor: '#f59e0b', alignment: 'right', margin: [8, 10, 10, 10] },
          ]],
        },
        layout: 'noBorders',
        margin: [0, 10, 0, 10],
      }]
    case 'signatureBlock': {
      const sigStack = [{ text: 'Authorized Signatory:', bold: true, margin: [0, 0, 0, 6] }]
      if (block.signatory.imageUrl) sigStack.push({ image: block.signatory.imageUrl, width: 90, height: 40, margin: [0, 0, 0, 2] })
      else sigStack.push({ text: ' ', margin: [0, 40, 0, 0] })
      sigStack.push(hLine(160))
      sigStack.push({ text: block.signatory.name, bold: true })
      if (block.signatory.title) sigStack.push({ text: block.signatory.title })

      const acceptStack = block.counterSignature
        ? [
            { text: block.counterSignature.label, bold: true, margin: [0, 0, 0, 46] },
            hLine(160),
            { text: block.counterSignature.caption, fontSize: 8 },
          ]
        : [{ text: ' ' }]

      return [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 1, lineColor: '#e5e7eb' }], margin: [0, 30, 0, 18] },
        { columns: [{ width: '50%', stack: sigStack }, { width: '50%', stack: acceptStack }] },
      ]
    }
    default:
      return []
  }
}

// pdfmake's image renderer can only take a data-URI it's already holding —
// no async mid-render — so any images in the IR must be normalized up front.
async function normalizeIrImages(ir) {
  const logoUrl = await normalizeImageForPdf(ir.letterhead.logoUrl)
  const blocks = await Promise.all(ir.blocks.map(async block => {
    if (block.type === 'signatureBlock' && block.signatory?.imageUrl) {
      const imageUrl = await normalizeImageForPdf(block.signatory.imageUrl)
      return { ...block, signatory: { ...block.signatory, imageUrl } }
    }
    return block
  }))
  return { ...ir, letterhead: { ...ir.letterhead, logoUrl }, blocks }
}

async function buildDocDefinition(ir) {
  const normalizedIr = await normalizeIrImages(ir)
  const content = [...renderLetterhead(normalizedIr.letterhead)]
  normalizedIr.blocks.forEach((block, i) => {
    const rendered = renderBlock(block)
    // THROUGH/SUBJECT lines sit tight against each other (2pt), but the HTML
    // letterhead's `space-y-4` gives every such group a real gap (~10pt)
    // before the next block (e.g. the "Dear ..." greeting) — only the last
    // labelValue in a run needs that bigger trailing gap.
    if (block.type === 'labelValue' && normalizedIr.blocks[i + 1]?.type !== 'labelValue' && rendered[0]?.margin) {
      rendered[0].margin[3] = 20
    }
    content.push(...rendered)
  })

  const footerText = ir.footerText ? ir.footerText.replace(/\n\s*\n+/g, '\n') : ''

  return {
    pageSize: 'LEGAL',
    pageMargins: [40, 40, 40, footerText ? 50 : 40],
    content,
    ...(footerText ? {
      footer: { text: footerText, fontSize: 7, color: '#9ca3af', alignment: 'center', margin: [40, 0, 40, 20] },
    } : {}),
    defaultStyle: { fontSize: 9 },
  }
}

export async function downloadAsPdf(ir, fileName) {
  const docDefinition = await buildDocDefinition(ir)
  const blob = await pdfMake.createPdf(docDefinition).getBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Opens the generated PDF in a new tab with the browser's print dialog
// auto-triggered (PDF "OpenAction" set to Print) — so "Print" prints our
// precisely-controlled PDF output, not whatever the browser's own print
// engine decides to do with the live HTML page.
export async function printPdf(ir) {
  // Must open the window synchronously in the click handler, before any
  // await, or popup blockers will block it.
  const win = window.open('', '_blank')
  if (win === null) throw new Error('Open PDF in new window blocked by browser')
  const docDefinition = await buildDocDefinition(ir)
  await pdfMake.createPdf(docDefinition).print(win)
}
