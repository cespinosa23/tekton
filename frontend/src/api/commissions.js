import client from './client'

export const getCommissions = async () => {
  const { data } = await client.get('/commissions/')
  return data
}

// Default terms (managed in Settings). Rates are percentages here (5 = 5%),
// both ways: { electrical_plan, project_management, project_management_margin,
// project_management_method }.
export const getCommissionRates = async () => {
  const { data } = await client.get('/commissions/rates')
  return data
}

export const updateCommissionRates = async (defaults) => {
  const { data } = await client.put('/commissions/rates', defaults)
  return data
}

// One commission's own terms (percentages). method/rate/margin_rate all null
// puts it back on the defaults.
export const setCommissionTerms = async ({ project_id, commission_type, method, rate, margin_rate }) => {
  const { data } = await client.put('/commissions/terms', { project_id, commission_type, method, rate, margin_rate })
  return data
}

export const setCommissionPayee = async ({ project_id, commission_type, payee_employee_id }) => {
  const { data } = await client.put('/commissions/payee', { project_id, commission_type, payee_employee_id })
  return data
}

export const releaseCommission = async ({ project_id, commission_type, release_date }) => {
  const { data } = await client.post('/commissions/release', { project_id, commission_type, release_date })
  return data
}

export const reverseCommission = async (id) => {
  const { data } = await client.post(`/commissions/${id}/reverse`)
  return data
}
