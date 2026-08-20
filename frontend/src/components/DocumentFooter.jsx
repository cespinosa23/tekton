// Shared print/preview footer — used identically by BillingPrint and
// QuotePreview. Collapses accidental blank lines the same way in both places.
export default function DocumentFooter({ footerText }) {
  if (!footerText) return null
  return (
    <p className="text-center text-xs text-gray-400 mt-10 leading-snug whitespace-pre-line">
      {footerText.replace(/\n\s*\n+/g, '\n')}
    </p>
  )
}
