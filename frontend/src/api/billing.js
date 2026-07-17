import client from './client'

export const getBillings = async () => {
  const { data } = await client.get('/billing/')
  return data
}

export const createBilling = async (payload) => {
  const { data } = await client.post('/billing/', payload)
  return data
}

export const archiveBilling = async (id) => {
  await client.delete(`/billing/${id}`)
}

export const setBillingPaid = async ({ id, is_paid, paid_date }) => {
  const { data } = await client.put(`/billing/${id}/paid`, { is_paid, paid_date })
  return data
}
