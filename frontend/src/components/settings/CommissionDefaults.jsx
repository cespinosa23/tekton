import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getCommissionRates, updateCommissionRates } from '../../api/commissions'
import { apiErrorMessage } from '../../utils/apiError'
import { METHOD_LABELS, METHOD_FORMULAS, isValidPercent, isTypablePercent } from '../../lib/commission'

const toDraft = (d) => ({
  electrical_plan: String(Number(d.electrical_plan)),
  project_management: String(Number(d.project_management)),
  project_management_margin: String(Number(d.project_management_margin)),
  project_management_method: d.project_management_method,
})

function PercentField({ id, value, onChange, disabled }) {
  return (
    <div className={`relative w-28 ${isValidPercent(value) || disabled ? '' : 'rounded-md ring-1 ring-red-400'}`}>
      <input id={id} type="text" inputMode="decimal" value={value} disabled={disabled}
        onChange={e => isTypablePercent(e.target.value) && onChange(e.target.value)}
        className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded-md text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400" />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
    </div>
  )
}

// Settings → Commission Defaults. The starting terms for every commission
// that hasn't been given its own on the Commissions page.
export default function CommissionDefaults() {
  const queryClient = useQueryClient()
  const { data: defaults } = useQuery({ queryKey: ['commissionRates'], queryFn: getCommissionRates })
  const [draft, setDraft] = useState(null)

  useEffect(() => { if (defaults) setDraft(toDraft(defaults)) }, [defaults])

  const mutation = useMutation({
    mutationFn: updateCommissionRates,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissionRates'] })
      queryClient.invalidateQueries({ queryKey: ['commissions'] })
      toast.success('Commission defaults saved')
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to save commission defaults')),
  })

  if (!draft) return <div className="text-center py-16 text-gray-400">Loading...</div>

  const set = (key) => (v) => setDraft(d => ({ ...d, [key]: v }))
  const saved = toDraft(defaults)
  const changed = Object.keys(draft).some(k => String(draft[k]) !== String(saved[k]))
  const valid = isValidPercent(draft.electrical_plan) && isValidPercent(draft.project_management)
    && isValidPercent(draft.project_management_margin)

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Commission Defaults</h3>
          <p className="text-xs text-gray-400">
            The starting terms for every commission. Each commission can be given its own method and rates on the
            Commissions page; those keep their own values when a default changes.
          </p>
        </div>
        <form className="p-6 space-y-6 text-sm"
          onSubmit={e => {
            e.preventDefault()
            mutation.mutate({
              electrical_plan: draft.electrical_plan.trim(),
              project_management: draft.project_management.trim(),
              project_management_margin: draft.project_management_margin.trim(),
              project_management_method: draft.project_management_method,
            })
          }}>
          <div>
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Project Management</p>
            <fieldset className="space-y-2 mb-4">
              <legend className="block text-xs font-medium text-gray-700 mb-1">Default method</legend>
              {Object.entries(METHOD_LABELS).map(([value, label]) => (
                <label key={value} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" name="default-method" value={value} className="mt-0.5"
                    checked={draft.project_management_method === value}
                    onChange={() => set('project_management_method')(value)} />
                  <span>
                    <span className="text-gray-900">{label}</span>
                    <span className="block text-xs text-gray-500">{METHOD_FORMULAS[value]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-6">
              <div>
                <label htmlFor="default-pm-rate" className="block text-xs font-medium text-gray-700 mb-1">Commission rate</label>
                <PercentField id="default-pm-rate" value={draft.project_management} onChange={set('project_management')} />
              </div>
              <div>
                <label htmlFor="default-pm-margin" className="block text-xs font-medium text-gray-700 mb-1">Margin</label>
                <PercentField id="default-pm-margin" value={draft.project_management_margin} onChange={set('project_management_margin')} />
                <p className="text-[11px] text-gray-400 mt-1">Used by the assumed-margin method only</p>
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">Electrical Plan</p>
            <label htmlFor="default-ep-rate" className="block text-xs font-medium text-gray-700 mb-1">Commission rate</label>
            <div className="flex items-center gap-2">
              <PercentField id="default-ep-rate" value={draft.electrical_plan} onChange={set('electrical_plan')} />
              <span className="text-gray-500">of the electrical plan cost</span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Saving applies right away to every unreleased commission that follows the defaults. Commissions with their
            own terms, and released commissions, don&apos;t change.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={!changed || mutation.isPending} onClick={() => setDraft(saved)}
              className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-50">Discard</button>
            <button type="submit" disabled={!changed || !valid || mutation.isPending}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50">
              {mutation.isPending ? 'Saving…' : 'Save defaults'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
