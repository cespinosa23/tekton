import client from './client'

const archivedOf = (resource) => async () => {
  const { data } = await client.get(`/${resource}/archived`)
  return data
}

const restoreIn = (resource) => async (id) => {
  const { data } = await client.post(`/${resource}/${id}/restore`)
  return data
}

const permanentDeleteIn = (resource) => async (id) => {
  await client.delete(`/${resource}/${id}/permanent`)
}

export const getArchivedEmployees    = archivedOf('employees')
export const getArchivedProjects     = archivedOf('projects')
export const getArchivedMaterials    = archivedOf('materials')
export const getArchivedTransactions = archivedOf('transactions')
export const getArchivedSuppliers    = archivedOf('suppliers')

export const restoreEmployee    = restoreIn('employees')
export const restoreProject     = restoreIn('projects')
export const restoreMaterial    = restoreIn('materials')
export const restoreTransaction = restoreIn('transactions')
export const restoreSupplier    = restoreIn('suppliers')

export const permanentDeleteEmployee    = permanentDeleteIn('employees')
export const permanentDeleteProject     = permanentDeleteIn('projects')
export const permanentDeleteMaterial    = permanentDeleteIn('materials')
export const permanentDeleteTransaction = permanentDeleteIn('transactions')
export const permanentDeleteSupplier    = permanentDeleteIn('suppliers')
