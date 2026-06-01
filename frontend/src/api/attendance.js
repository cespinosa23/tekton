import client from './client'

export const getAttendance = async () => {
  const { data } = await client.get('/attendance/')
  return data
}

export const getEmployees = async () => {
  const { data } = await client.get('/employees/')
  return data.filter(e => e.status === 'Active')
}

export const getProjects = async () => {
  const { data } = await client.get('/projects/')
  return data.filter(p => p.status === 'Active')
}

export const createAttendance = async (payload) => {
  const { data } = await client.post('/attendance/', payload)
  return data
}

export const updateAttendance = async ({ id, data: payload }) => {
  const { data } = await client.put(`/attendance/${id}`, payload)
  return data
}

export const deleteAttendance = async (id) => {
  await client.delete(`/attendance/${id}`)
}