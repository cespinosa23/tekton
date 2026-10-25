import client from './client'

export const getQuotations = async () => {
  const { data } = await client.get('/quotations/')
  return data
}

// One quotation in full. The list above leaves out the logo and signature
// images (they're ~95% of a quotation's size); this is how the page gets them
// when it needs to preview, print, download or clone.
export const getQuotation = async (id) => {
  const { data } = await client.get(`/quotations/${id}`)
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

export const markQuotationClientRejected = async ({ id, note }) => {
  const { data } = await client.post(`/quotations/${id}/mark-client-rejected`, { note })
  return data
}

export const reverseQuotationClientRejected = async (id) => {
  const { data } = await client.post(`/quotations/${id}/reverse-client-rejected`)
  return data
}
