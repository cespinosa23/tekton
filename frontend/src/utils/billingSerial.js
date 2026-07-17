const PREFIXES = { down_payment: 'DP', progress: 'PB', retention_release: 'RR' }

export const formatBillingSerial = (billing) =>
  `${PREFIXES[billing.billing_type] || 'BR'}-${String(billing.id).padStart(6, '0')}`
