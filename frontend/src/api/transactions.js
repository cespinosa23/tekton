import client from './client'

export const getTransactions = async () => {
  const { data } = await client.get('/transactions/')
  return data
}

export const getProjects = async () => {
  const { data } = await client.get('/projects/')
  return data
}

export const getMaterials = async () => {
  const { data } = await client.get('/materials/')
  return data
}

export const getSuppliers = async () => {
  const { data } = await client.get('/suppliers/')
  return data
}

export const getSettings = async () => {
  const { data } = await client.get('/settings/')
  return data
}

export const getInventory = async () => {
  const { data } = await client.get('/inventory/')
  return data
}

export const createTransaction = async (payload) => {
  const { data } = await client.post('/transactions/', payload)
  return data
}

export const updateTransaction = async ({ id, data: payload }) => {
  const { data } = await client.put(`/transactions/${id}`, payload)
  return data
}

export const archiveTransaction = async (id) => {
  await client.delete(`/transactions/${id}`)
}

export const getMaterialTypes = async () => {
  const { data } = await client.get('/material-types/')
  return data
}