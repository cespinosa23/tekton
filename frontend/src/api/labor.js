import client from './client'

// Per-project labor totals from the server — { by_project: { [projectId]: "amount" }, unassigned: "amount" }.
// Individual attendance pay is Admin-only, so any screen that shows a labor
// *total* to other roles uses this instead of summing attendance records.
// start/end: optional inclusive 'yyyy-MM-dd' dates.
export const getLaborTotals = async ({ start, end } = {}) => {
  const { data } = await client.get('/labor/totals', { params: { start, end } })
  return data
}

export const laborFor = (totals, projectId) => parseFloat(totals?.by_project?.[projectId]) || 0

export const laborSum = (totals) =>
  Object.values(totals?.by_project || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0) + (parseFloat(totals?.unassigned) || 0)
