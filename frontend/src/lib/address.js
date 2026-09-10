// Joins structured address fields (address_line1/2, city, state_province, postal_code,
// country) for display; falls back to the old free-text `address` column for records
// that haven't been re-entered into the new fields yet. Shared by Company and Project.
export function formatAddress(o) {
  if (!o) return ''
  const parts = [o.address_line1, o.address_line2, o.city, o.state_province, o.postal_code, o.country].filter(Boolean)
  return parts.length ? parts.join(', ') : (o.address || '')
}

// Same structured fields as formatAddress, but arranged as document-style lines:
// Line 1, Line 2 (omitted if empty), then City, Province, Postal, Country on one line.
// Falls back to the legacy `address` column (as a single line) if none of the
// structured fields are set. Used for Preview/PDF/DOCX/print output.
export function formatAddressLines(o) {
  if (!o) return []
  const cityLine = [o.city, o.state_province, o.postal_code, o.country].filter(Boolean).join(', ')
  const lines = [o.address_line1, o.address_line2, cityLine].filter(Boolean)
  return lines.length ? lines : (o.address ? [o.address] : [])
}

// formatAddressLines joined with '\n' — the multi-line convention this codebase's
// PDF/DOCX renderers already split on (see toPdf.js/toDocx.js addressBlock).
export function formatAddressBlock(o) {
  return formatAddressLines(o).join('\n')
}

// Maps a Quotation's addressee_* columns into the generic structured-address shape
// so formatAddress/formatAddressLines/formatAddressBlock can be reused for it.
export function addresseeAddress(quote) {
  if (!quote) return {}
  return {
    address_line1: quote.addressee_address_line1,
    address_line2: quote.addressee_address_line2,
    city: quote.addressee_city,
    state_province: quote.addressee_state_province,
    postal_code: quote.addressee_postal_code,
    country: quote.addressee_country,
    address: quote.addressee_address,
  }
}
