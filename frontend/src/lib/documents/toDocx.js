import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, ImageRun, BorderStyle, Header, Footer,
} from 'docx'
import { formatPhoneLines } from '../../utils/phoneFormat'

const DEFAULT_LETTERHEAD_COLOR = '1E40AF'
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }

function ph(text = '', opts = {}) {
  return new Paragraph({ children: [new TextRun({ text: String(text), ...opts })] })
}
function phRight(text = '', opts = {}) {
  return new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: String(text), ...opts })] })
}
function blank() {
  return new Paragraph({ text: '' })
}
const peso = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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

// Converts RichTextEditor's sanitized HTML (b/i/ul/ol/p/div/br only) into
// docx Paragraphs — ordered lists render as plain "1. " prefixes rather than
// real Word numbering.xml, which keeps this simple for a short editor.
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

function renderLetterhead(letterhead) {
  const letterColor = hexColor(letterhead.letterheadColor)
  const logoImage = dataUriToImage(letterhead.logoUrl)

  const left = []
  if (logoImage) {
    left.push(new Paragraph({ children: [new ImageRun({ data: logoImage.data, type: logoImage.type, transformation: { width: 56, height: 56 } })] }))
  }
  if (letterhead.companyName) left.push(ph(letterhead.companyName.toUpperCase(), { bold: true, size: 32, color: letterColor }))
  if (letterhead.shortName) left.push(ph(letterhead.shortName, { bold: true, size: 24, color: letterColor }))
  if (letterhead.pcabLicense) left.push(ph(`PCAB License: ${letterhead.pcabLicense}`, { size: 14, color: letterColor }))
  if (left.length === 0) left.push(blank())

  // Word can't embed the lucide SVGs the PDF uses, so plain Unicode glyphs
  // (widely supported, no extra assets) stand in for the mail/phone/mobile
  // icons — colored/sized to match the HTML letterhead's text-xs text-gray-600.
  const contactOpts = { size: 18, color: '4B5563' }
  const right = []
  if (letterhead.email) right.push(phRight(`✉  ${letterhead.email}`, contactOpts))
  formatPhoneLines(letterhead.telephoneNumber).forEach(line => right.push(phRight(`☎  ${line}`, contactOpts)))
  formatPhoneLines(letterhead.contactNumber).forEach(line => right.push(phRight(`☏  ${line}`, contactOpts)))
  if (right.length === 0) right.push(blank())

  return [
    new Table({
      borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [
          new TableCell({ borders: NO_BORDERS, width: { size: 65, type: WidthType.PERCENTAGE }, children: left }),
          new TableCell({ borders: NO_BORDERS, width: { size: 35, type: WidthType.PERCENTAGE }, children: right }),
        ],
      })],
    }),
    // The HTML/PDF letterhead has a rule under it (`border-b-2 border-gray-800`)
    // — an empty paragraph with a bottom border draws the same line in Word.
    new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '1F2937' } }, spacing: { before: 160, after: 200 } }),
  ]
}

function renderCell(cell) {
  if (cell && typeof cell === 'object' && 'heading' in cell) {
    const paragraphs = [ph(cell.heading, { bold: true })]
    ;(cell.bullets || []).forEach(b => {
      paragraphs.push(ph(`   •  ${b.text}`))
      ;(b.subBullets || []).forEach(note => paragraphs.push(ph(`        -  ${note}`, { italics: true, size: 20 })))
    })
    return new TableCell({ children: paragraphs })
  }
  return new TableCell({ children: [ph(String(cell ?? ''))] })
}

function renderTable(table, color = DEFAULT_LETTERHEAD_COLOR) {
  const headerRow = new TableRow({
    children: table.columns.map(c => new TableCell({
      shading: { fill: color },
      children: [new Paragraph({ children: [new TextRun({ text: c.header, bold: true, color: 'FFFFFF' })] })],
    })),
  })
  const dataRows = table.rows.map(row => new TableRow({ children: row.map(renderCell) }))
  const rows = [headerRow, ...dataRows]
  if (table.totalRow) {
    const [label, amount] = table.totalRow
    rows.push(new TableRow({
      children: [
        new TableCell({
          columnSpan: table.columns.length - 1,
          shading: { fill: color },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: label, bold: true, color: 'FFFFFF' })] })],
        }),
        new TableCell({
          shading: { fill: color },
          children: [new Paragraph({ children: [new TextRun({ text: amount, bold: true, color: 'FFFFFF' })] })],
        }),
      ],
    }))
  }
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
}

// A bullet item's text can carry embedded newlines (e.g. a Payment Terms
// template's "1st Payment: ... \n2nd Payment: ..." lines) — a single
// TextRun doesn't render \n as a line break, so each line becomes its own
// paragraph; only the first gets the bullet marker, the rest are indented
// to line up under it.
function pushBulletItem(children, text) {
  String(text ?? '').split('\n').forEach((line, i) => children.push(ph(i === 0 ? `•  ${line}` : `     ${line}`)))
}

function renderSectionContent(content, color) {
  const children = []
  if (content.kind === 'table') {
    children.push(renderTable(content, color))
  } else if (content.kind === 'tableGroup') {
    content.groups.forEach(g => {
      children.push(ph(g.heading, { bold: true }))
      children.push(renderTable(g.table, color))
      children.push(blank())
    })
  } else if (content.kind === 'richTextHtml') {
    children.push(...htmlToDocxParagraphs(content.html))
  } else if (content.kind === 'bulletList') {
    content.items.forEach(text => pushBulletItem(children, text))
  } else if (content.kind === 'labeledBlocks') {
    content.blocks.forEach(b => {
      children.push(ph(b.label, { bold: true }))
      if (b.kind === 'bulletList') {
        b.items.forEach(text => pushBulletItem(children, text))
      } else {
        b.text.split('\n').forEach(line => children.push(ph(line)))
      }
      children.push(blank())
    })
  }
  return children
}

function renderBlock(block, letterheadColor) {
  switch (block.type) {
    case 'date':
      return [ph(block.text), blank(), blank()]
    case 'addressBlock': {
      const out = []
      if (block.name) out.push(ph(block.name.toUpperCase(), { bold: true }))
      if (block.name && block.address) out.push(blank())
      if (block.address) out.push(ph(block.address))
      out.push(blank(), blank())
      return out
    }
    case 'labelValue':
      return [new Paragraph({ children: [new TextRun({ text: block.label, bold: true }), new TextRun({ text: `  :  ${block.value}` })] })]
    case 'paragraph':
      return [ph(block.text), blank()]
    case 'keyValueBlock': {
      const out = [new Paragraph({ children: [new TextRun({ text: block.title, bold: true, size: 24, underline: {} })], spacing: { before: 240, after: 120 } })]
      block.rows.forEach(([label, val]) => out.push(new Paragraph({ children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun({ text: val })] })))
      out.push(blank())
      return out
    }
    case 'section': {
      const tableColor = (letterheadColor || '#1e40af').replace('#', '').toUpperCase()
      return [ph(`${block.number}. ${block.title}`, { bold: true, size: 24 }), ...renderSectionContent(block.content, tableColor), blank()]
    }
    case 'totalBanner': {
      const bannerFill = (letterheadColor || '#1e40af').replace('#', '').toUpperCase()
      return [
        new Table({
          borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [new TableRow({
            children: [
              new TableCell({
                borders: NO_BORDERS,
                shading: { fill: bannerFill },
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: block.label, bold: true, size: 27, color: 'FFFFFF' })] })],
              }),
              new TableCell({
                borders: NO_BORDERS,
                shading: { fill: bannerFill },
                width: { size: 50, type: WidthType.PERCENTAGE },
                children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: peso(block.amount), bold: true, size: 36, color: 'FFFFFF' })] })],
              }),
            ],
          })],
        }),
        blank(),
      ]
    }
    case 'signatureBlock': {
      const sigImage = dataUriToImage(block.signatory.imageUrl)
      const signatoryParagraphs = [ph('Authorized Signatory:', { bold: true })]
      if (sigImage) {
        signatoryParagraphs.push(new Paragraph({ children: [new ImageRun({ data: sigImage.data, type: sigImage.type, transformation: { width: 100, height: 45 } })] }))
      } else {
        signatoryParagraphs.push(blank())
      }
      signatoryParagraphs.push(ph(block.signatory.name, { bold: true }))
      if (block.signatory.title) signatoryParagraphs.push(ph(block.signatory.title))

      const acceptanceParagraphs = block.counterSignature
        ? [ph(block.counterSignature.label, { bold: true }), blank(), ph(block.counterSignature.caption, { size: 16 })]
        : [blank()]

      return [blank(), new Table({
        borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [new TableRow({
          children: [
            new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: signatoryParagraphs }),
            new TableCell({ borders: NO_BORDERS, width: { size: 50, type: WidthType.PERCENTAGE }, children: acceptanceParagraphs }),
          ],
        })],
      })]
    }
    default:
      return []
  }
}

export async function downloadAsDocx(ir, fileName) {
  const children = []
  ir.blocks.forEach((block, i) => {
    children.push(...renderBlock(block, ir.letterhead.letterheadColor))
    if (block.type === 'labelValue' && ir.blocks[i + 1]?.type !== 'labelValue') children.push(blank(), blank())
  })

  // Real Word header/footer (not body content) — repeats on every page, and
  // keeps its own spacing independent of wherever the body happens to end.
  let footers
  if (ir.footerText) {
    const lines = ir.footerText.replace(/\n\s*\n+/g, '\n').split('\n').map(s => s.trim()).filter(Boolean)
    const runs = []
    lines.forEach((line, i) => {
      if (i > 0) runs.push(new TextRun({ text: '', break: 1 }))
      runs.push(new TextRun({ text: line, size: 18, color: '666666' }))
    })
    footers = { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: runs })] }) }
  }

  const doc = new Document({
    sections: [{
      // Legal size (8.5 x 14in = 12240 x 20160 twips) — the app-wide document
      // standard, matching the PDF renderer's pageSize: 'LEGAL'.
      properties: { page: { size: { width: 12240, height: 20160 } } },
      headers: { default: new Header({ children: renderLetterhead(ir.letterhead) }) },
      ...(footers ? { footers } : {}),
      children,
    }],
  })
  const blob = await Packer.toBlob(doc)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
