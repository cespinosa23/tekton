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
