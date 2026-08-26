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

export const downloadMaterialsTemplate = async () => {
  const { data } = await client.get('/materials/import-template', { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'materials_import_template.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const importMaterials = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post('/materials/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}