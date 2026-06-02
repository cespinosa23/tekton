import client from './client'

export const getEmployees = async () => {
  const { data } = await client.get('/employees/')
  return data
}

export const createEmployee = async (payload) => {
  const { data } = await client.post('/employees/', payload)
  return data
}

export const updateEmployee = async ({ id, data: payload }) => {
  const { data } = await client.put(`/employees/${id}`, payload)
  return data
}

export const archiveEmployee = async (id) => {
  await client.delete(`/employees/${id}`)
}

export const inviteEmployee = async ({ email, roles }) => {
  const { data } = await client.post('/users/invite', { email, roles })
  return data
}

export const resendInvite = async (email) => {
  const { data } = await client.post(`/users/resend-invite?email=${encodeURIComponent(email)}`)
  return data
}

export const getEmployeeUsers = async () => {
  const { data } = await client.get('/users/employee-roles')
  return data
}