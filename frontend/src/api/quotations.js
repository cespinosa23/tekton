import client from './client'

export const getQuotations = async () => {
  const { data } = await client.get('/quotations/')
  return data
}

export const createQuotation = async (payload) => {
  const { data } = await client.post('/quotations/', payload)
  return data
}

export const updateQuotation = async ({ id, data: payload }) => {
  const { data } = await client.put(`/quotations/${id}`, payload)
  return data
}

export const archiveQuotation = async (id) => {
  await client.delete(`/quotations/${id}`)
}

export const requestQuotationApproval = async ({ id, approver_user_id }) => {
  const { data } = await client.post(`/quotations/${id}/request-approval`, { approver_user_id })
  return data
}

export const approveQuotation = async (id) => {
  const { data } = await client.post(`/quotations/${id}/approve`)
  return data
}

export const rejectQuotation = async ({ id, reason }) => {
  const { data } = await client.post(`/quotations/${id}/reject`, { reason })
  return data
}
