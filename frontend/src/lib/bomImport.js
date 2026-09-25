import ExcelJS from 'exceljs'
import { calcRow, emptyBomRow } from './bomRow'
import { bestInventoryFor } from './inventoryPricing'

export const IMPORT_HEADERS = ['Material Type', 'Material Name', 'Unit', 'Qty']

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Builds and downloads the BOM import template. Material Type is a real
// dropdown, not free text — sourced live from the current (active) Settings >
// Material Types list, via a hidden reference sheet. A cell-range reference
// is used instead of an inline comma list because Excel caps inline
// list-validation formulae at ~255 characters, which a growing type list
// could exceed.
//
// A second, VISIBLE sheet ("Existing Materials") lists every active catalog
// material so the person filling this in can copy the exact Type + Name text
// rather than retyping from memory — the closer that text matches the
// catalog, the higher the auto-match rate on import. It's purely a
// human-readability aid: parseBomImportFile always reads worksheets[0], so
// this must be added AFTER the "BOM Import" sheet to not shift that index.
export async function downloadBomImportTemplate(materialTypes = [], materials = []) {
  const activeTypeNames = materialTypes.filter(t => !t.archived).map(t => t.name)

  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('BOM Import')
  sheet.columns = [
    { header: 'Material Type', key: 'material_type', width: 26 },
    { header: 'Material Name', key: 'material_name', width: 34 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'Qty', key: 'quantity', width: 10 },
  ]
  sheet.getRow(1).font = { bold: true }

  if (activeTypeNames.length > 0) {
    const ref = wb.addWorksheet('Reference')
    ref.state = 'hidden'
    activeTypeNames.forEach((name, i) => { ref.getCell(`A${i + 1}`).value = name })
    const rangeFormula = `Reference!$A$1:$A$${activeTypeNames.length}`

    for (let row = 2; row <= 300; row++) {
      sheet.getCell(`A${row}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [rangeFormula],
        showErrorMessage: true,
        errorStyle: 'warning',
        errorTitle: 'Unknown Material Type',
        error: "Pick a value from the dropdown, or leave blank if unsure — it'll just need a manual price after import.",
      }
    }
  }

  const activeMaterials = materials
    .filter(m => !m.archived)
    .slice()
    .sort((a, b) => (a.material_type || '').localeCompare(b.material_type || '') || a.rating_size.localeCompare(b.rating_size))

  if (activeMaterials.length > 0) {
    const catalogSheet = wb.addWorksheet('Existing Materials')
    catalogSheet.columns = [
      { header: 'Material Type', key: 'material_type', width: 26 },
      { header: 'Material Name', key: 'material_name', width: 34 },
      { header: 'Unit', key: 'unit', width: 12 },
    ]
    catalogSheet.getRow(1).font = { bold: true }
    catalogSheet.views = [{ state: 'frozen', ySplit: 1 }]
    activeMaterials.forEach(m => catalogSheet.addRow({
      material_type: m.material_type || '', material_name: m.rating_size, unit: m.unit || '',
    }))
    catalogSheet.autoFilter = { from: 'A1', to: `C${activeMaterials.length + 1}` }
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    'BOM_Import_Template.xlsx'
  )
}

// A cell's .value can be a plain string/number, or (for a formula/rich-text/
// error cell) an object carrying the resolved value under
// .result/.text/.richText/.error. A formula error (e.g. #REF!) has none of
// those matched keys but is still an object — falling through to
// String(value) on it would render the literal text "[object Object]" into
// the imported Material Type/Name, so that case returns '' instead (an
// unreadable cell is treated the same as an empty one).
function cellText(value) {
  if (value == null) return ''
  if (typeof value === 'object') {
    if ('result' in value) return cellText(value.result)
    if ('richText' in value) return value.richText.map(r => r.text).join('')
    if ('text' in value) return cellText(value.text)
    if ('error' in value) return ''
    return ''
  }
  return String(value).trim()
}

// Reads the uploaded file and returns raw {material_type, material_name,
// unit, quantity} rows — no catalog matching here, that's matchImportRows.
// Refuses anything that doesn't have the exact template headers, rather than
// guessing at a different column order.
export async function parseBomImportFile(file) {
  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const sheet = wb.worksheets[0]
  if (!sheet) throw new Error('This file has no sheets to read.')

  const headerRow = sheet.getRow(1)
  const expected = IMPORT_HEADERS.map(h => h.toLowerCase())
  const actual = IMPORT_HEADERS.map((_, i) => cellText(headerRow.getCell(i + 1).value).toLowerCase())
  if (!expected.every((h, i) => actual[i] === h)) {
    throw new Error(
      `This doesn't look like the BOM import template — expected columns "${IMPORT_HEADERS.join('", "')}" in that order. Please use the downloaded template.`
    )
  }

  const rows = []
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const material_type = cellText(row.getCell(1).value)
    const material_name = cellText(row.getCell(2).value)
    const unit = cellText(row.getCell(3).value)
    // Negative values shouldn't reach the BOM at all — the manual Qty input
    // already blocks typing a '-', so an imported row is held to the same
    // floor rather than silently producing a negative subtotal.
    const quantity = Math.max(parseFloat(cellText(row.getCell(4).value)) || 0, 0)
    // A row with every text column blank and a quantity of 0 (not just
    // literally empty — a stray formula or pasted 0 lands here too) has
    // nothing in it to import; skip it rather than adding a blank BOM row.
    if (!material_type && !material_name && !unit && quantity === 0) return
    rows.push({ material_type, material_name, unit, quantity })
  })

  if (rows.length === 0) throw new Error('No material rows found in the uploaded file.')
  return rows
}

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')

// The core safety rule: a row only auto-attaches to a catalog material on an
// exact, unique (Type, Name) match. Zero or multiple matches both fall back
// to a custom row flagged needs_review — never a guessed match, since a
// silently-wrong material would mean silently-wrong pricing on the
// quotation.
export function matchImportRows(parsedRows, { materials = [], inventoryRecords = [] } = {}) {
  let matchedCount = 0
  let reviewCount = 0

  const rows = parsedRows.map(r => {
    const candidates = materials.filter(m =>
      norm(m.material_type) === norm(r.material_type) && norm(m.rating_size) === norm(r.material_name)
    )

    if (candidates.length === 1) {
      matchedCount++
      const mat = candidates[0]
      const inv = bestInventoryFor(mat.id, inventoryRecords)
      return calcRow({
        ...emptyBomRow(),
        is_custom: false,
        material_id: mat.id,
        material_type: mat.material_type || '',
        material_name: mat.rating_size,
        // Matched rows always take Unit from the catalog record, never the
        // imported file, so it can't drift from the material's real unit.
        unit: mat.unit || '',
        quantity: r.quantity,
        unit_price: inv ? Number(inv.latest_unit_cost) || 0 : 0,
        source: inv?.latest_cost_supplier || '',
        price_entry_date: inv?.latest_cost_date || null,
        is_canvass_price: inv?.latest_cost_is_canvass || false,
      })
    }

    reviewCount++
    return calcRow({
      ...emptyBomRow(),
      is_custom: true,
      material_type: r.material_type,
      material_name: r.material_name,
      unit: r.unit,
      quantity: r.quantity,
      needs_review: true,
    })
  })

  return { rows, matchedCount, reviewCount }
}
