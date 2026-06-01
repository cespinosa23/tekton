import client from './client'

export const getProjects = async () => {
  const { data } = await client.get('/projects/')
  return data
}

export const getTransactions = async () => {
  const { data } = await client.get('/transactions/')
  return data
}

export const getEmployees = async () => {
  const { data } = await client.get('/employees/')
  return data
}

export const getCalendarDays = async () => {
  const { data } = await client.get('/calendar-days/')
  return data
}

export const createCalendarDay = async (payload) => {
  const { data } = await client.post('/calendar-days/', payload)
  return data
}

export const updateCalendarDay = async ({ id, data: payload }) => {
  const { data } = await client.put(`/calendar-days/${id}`, payload)
  return data
}