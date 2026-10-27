import { useState } from 'react'
import { isTypableQuantity, parseQuantity } from '../lib/quantity'

// Quantity box that accepts decimals (up to 2 places) and fractions.
// While focused it keeps the literal text being typed, so "0.", ".2" or
// "1/" don't snap back to the stored number mid-keystroke (the old boxes
// re-rendered from the number and swallowed the decimal point). Decimal
// values update the row live; a fraction is converted when the box loses
// focus ("1 1/2" -> 1.5). An unfinished entry reverts on blur.
export default function QuantityInput({ value, onChange, disabled, className, placeholder = '0', format = (n) => String(n) }) {
  const [draft, setDraft] = useState(null) // text while focused, null otherwise
  const shown = draft ?? (Number(value) === 0 || value == null ? '' : format(Number(value)))

  return (
    <input
      type="text"
      inputMode="decimal"
      value={shown}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      title="Decimals up to 2 places, or a fraction like 1/4 or 1 1/2"
      onFocus={() => setDraft(Number(value) === 0 || value == null ? '' : String(value))}
      onChange={e => {
        const raw = e.target.value.replace(/,/g, '')
        if (!isTypableQuantity(raw)) return
        setDraft(raw)
        // Plain decimals update right away (totals follow as you type);
        // fractions wait until the box loses focus.
        if (!raw.includes('/')) {
          const n = parseQuantity(raw)
          if (n !== null) onChange(n)
        }
      }}
      onBlur={() => {
        const n = parseQuantity(draft ?? '')
        if (n !== null) onChange(n)
        setDraft(null)
      }}
    />
  )
}
