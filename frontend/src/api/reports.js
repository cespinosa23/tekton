import client from './client'

// Totals calculated on the server (backend/app/api/reports.py), so report
// screens don't download every transaction and attendance record.

// { projects: { [id]: { labor_cost, materials_cost, others_cost, total_paid, last_activity } },
//   unassigned: { ...same, for records with no project } } — money as strings
export const getProjectTotals = async () => (await client.get('/reports/project-totals')).data

// [{ month: 'YYYY-MM', revenue, labor, materials, general }] for `months` months ending at endMonth (Admin only)
export const getMonthlyTrend = async ({ endMonth, months = 6 }) =>
  (await client.get('/reports/monthly', { params: { end_month: endMonth, months } })).data

// [{ material_id, brand, starting_quantity, quantity_in, quantity_out }] for one month 'YYYY-MM'
export const getInventoryMovement = async (month) =>
  (await client.get('/reports/inventory-movement', { params: { month } })).data

// Helpers for reading the money strings
const num = (v) => parseFloat(v) || 0
export const totalsFor = (totals, projectId) => {
  const t = totals?.projects?.[projectId]
  return {
    laborCost: num(t?.labor_cost), materialsCost: num(t?.materials_cost),
    othersCost: num(t?.others_cost), totalPaid: num(t?.total_paid),
    lastActivity: t?.last_activity || null,
  }
}
