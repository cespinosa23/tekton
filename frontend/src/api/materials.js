import client from './client'

export const getMaterials = async () => {
  const { data } = await client.get('/materials/')
  return data
}

export const getMaterialTypes = async () => {
  const { data } = await client.get('/material-types/')
  return data
}

export const getSettings = async () => {
  const { data } = await client.get('/settings/')
  return data
}

export const createMaterial = async (payload) => {
  const { data } = await client.post('/materials/', payload)
  return data
}

export const updateMaterial = async ({ id, data: payload }) => {
  const { data } = await client.put(`/materials/${id}`, payload)
  return data
}

export const archiveMaterial = async (id) => {
  await client.delete(`/materials/${id}`)
}