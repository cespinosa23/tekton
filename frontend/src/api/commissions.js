import client from './client'

export const getCommissions = async () => {
  const { data } = await client.get('/commissions/')
  return data
}

// Rates are percentages here (5 = 5%), both ways.
export const getCommissionRates = async () => {
  const { data } = await client.get('/commissions/rates')
  return data
}

export const updateCommissionRates = async ({ electrical_plan, project_management }) => {
  const { data } = await client.put('/commissions/rates', { electrical_plan, project_management })
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
