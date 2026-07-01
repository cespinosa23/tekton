import client from './client'

export const getSettings = async () => {
  const { data } = await client.get('/settings/')
  return data
}

export const createSetting = async (payload) => {
  const { data } = await client.post('/settings/', payload)
  return data
}

export const updateSetting = async ({ id, data: payload }) => {
  const { data } = await client.put(`/settings/${id}`, payload)
  return data
}

export const archiveSetting = async (id) => {
  await client.delete(`/settings/${id}`)
}

export const getCompanies = async () => {
  const { data } = await client.get('/companies/')
  return data
}

export const createCompany = async (payload) => {
  const { data } = await client.post('/companies/', payload)
  return data
}

export const updateCompany = async ({ id, data: payload }) => {
  const { data } = await client.put(`/companies/${id}`, payload)
  return data
}

export const deleteCompany = async (id) => {
  await client.delete(`/companies/${id}`)
}

export const getMaterialTypes = async () => {
  const { data } = await client.get('/material-types/')
  return data
}

export const createMaterialType = async (payload) => {
  const { data } = await client.post('/material-types/', payload)
  return data
}

export const updateMaterialType = async ({ id, data: payload }) => {
  const { data } = await client.put(`/material-types/${id}`, payload)
  return data
}

export const archiveMaterialType = async (id) => {
  await client.delete(`/material-types/${id}`)
}

export const addBrandToType = async ({ typeId, brand_name }) => {
  const { data } = await client.post(`/material-types/${typeId}/brands`, { brand_name })
  return data
}

export const removeBrandFromType = async ({ typeId, brandId }) => {
  await client.delete(`/material-types/${typeId}/brands/${brandId}`)
}

export const getSuppliers = async () => {
  const { data } = await client.get('/suppliers/')
  return data
}

export const createSupplier = async (payload) => {
  const { data } = await client.post('/suppliers/', payload)
  return data
}

export const updateSupplier = async ({ id, data: payload }) => {
  const { data } = await client.put(`/suppliers/${id}`, payload)
  return data
}

export const archiveSupplier = async (id) => {
  await client.delete(`/suppliers/${id}`)
}

export const resetAllData = async () => {
  const { data } = await client.post('/admin/reset')
  return data
}

export const getSystemUsers = async () => {
  const { data } = await client.get('/admin/users')
  return data
}

export const forceLogoutUser = async (userId) => {
  const { data } = await client.post(`/admin/users/${userId}/force-logout`)
  return data
}