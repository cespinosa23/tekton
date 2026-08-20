import { Mail, Phone, Smartphone } from 'lucide-react'
import { formatPhoneLines } from '../utils/phoneFormat'

// Shared print/preview letterhead — used identically by BillingPrint and
// QuotePreview so the two documents never visually drift apart. Takes a
// company-shaped object: { logo_url, company_name, short_name, pcab_license,
// letterhead_color, email, telephone_number, contact_number }.
export default function DocumentLetterhead({ company }) {
  if (!company) return null
  return (
    <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4 mb-6">
      <div className="flex items-start gap-3">
        {company.logo_url && (
          <img src={company.logo_url} alt="" className="h-16 w-16 object-contain" />
        )}
        <div>
          <h1 className="text-2xl font-bold leading-tight" style={{ color: company.letterhead_color || '#1e40af' }}>{company.company_name?.toUpperCase()}</h1>
          {company.short_name && <p className="text-lg font-medium leading-tight" style={{ color: company.letterhead_color || '#1e40af' }}>{company.short_name}</p>}
          {company.pcab_license && <p className="text-[10px] leading-tight mt-0" style={{ color: company.letterhead_color || '#1e40af' }}>PCAB License: {company.pcab_license}</p>}
        </div>
      </div>
      <div className="text-left text-xs text-gray-600 space-y-1 flex-shrink-0">
        {company.email && (
          <p className="flex items-center justify-start gap-1.5"><Mail size={12} />{company.email}</p>
        )}
        {formatPhoneLines(company.telephone_number).map((line, i) => (
          <p key={`tel-${i}`} className="flex items-center justify-start gap-1.5"><Phone size={12} />{line}</p>
        ))}
        {formatPhoneLines(company.contact_number).map((line, i) => (
          <p key={`cell-${i}`} className="flex items-center justify-start gap-1.5"><Smartphone size={12} />{line}</p>
        ))}
      </div>
    </div>
  )
}
