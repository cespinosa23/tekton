import client from './client'

export const getMaterials = async () => {
  const { data } = await client.get('/materials/')
  return data
}

export const getTransactions = async () => {
  const { data } = await client.get('/transactions/')
  return data
}

export const getInventoryRecords = async () => {
  const { data } = await client.get('/inventory/')
  return data
}

export const getMaterialTypes = async () => {
  const { data } = await client.get('/material-types/')
  return data
}