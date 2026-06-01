import client from './client'

export const getProjects = async () => {
  const { data } = await client.get('/projects/')
  return data
}

export const createProject = async (payload) => {
  const { data } = await client.post('/projects/', payload)
  return data
}

export const updateProject = async ({ id, data: payload }) => {
  const { data } = await client.put(`/projects/${id}`, payload)
  return data
}

export const archiveProject = async (id) => {
  await client.delete(`/projects/${id}`)
}

export const getTransactions = async () => {
  const { data } = await client.get('/transactions/')
  return data
}

export const getAttendance = async () => {
  const { data } = await client.get('/attendance/')
  return data
}

export const getSettings = async () => {
  const { data } = await client.get('/settings/')
  return data
}