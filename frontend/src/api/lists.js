import client from './client'

// Filtered list fetches, so screens download only what they show instead of
// tables that grow every day. All filters are optional (inclusive dates as
// 'yyyy-MM-dd'); empty/undefined ones are left off.
//
// These take a plain filters object. Don't pass them straight to useQuery as
// `queryFn: listTransactions` — React Query calls queryFn with its own
// context object; wrap them: `queryFn: () => listTransactions({ ... })`.

const clean = (filters = {}) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)))

// FastAPI reads repeated keys (?transaction_type=a&transaction_type=b), not axios's default "a[]=".
const opts = (filters) => ({ params: clean(filters), paramsSerializer: { indexes: null } })

// { start, end, project_id, transaction_type: ['Payment', ...] }
export const listTransactions = async (filters) => (await client.get('/transactions/', opts(filters))).data

// { start, end, project_id, employee_id }
export const listAttendance = async (filters) => (await client.get('/attendance/', opts(filters))).data

// { project_id }
export const listBillings = async (filters) => (await client.get('/billing/', opts(filters))).data
