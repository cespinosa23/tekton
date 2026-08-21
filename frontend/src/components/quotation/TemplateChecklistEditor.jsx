// Flat checklist of templated items (managed in Settings under Quotation
// Settings), same checkbox-off-a-template pattern as SowEditor's sub-items
// but without the type/category layer. Reused for both the Others step
// (Other Notes & Exclusions — multi-select) and the Payment Terms step
// (single-select — only one payment term applies per quote).
export default function TemplateChecklistEditor({ items: itemsProp, onChange, templates = [], disabled = false, emptyLabel = 'No items set up yet — add some in Settings first.', singleSelect = false }) {
  const items = itemsProp || []
  const availableTemplates = templates.filter(t => !t.archived)

  const selectSingle = (template) => {
    if (disabled) return
    onChange([{ item_id: template.id, text: template.text }])
  }

  const toggleItem = (template) => {
    if (disabled) return
    const included = items.some(i => i.item_id === template.id)
    onChange(included
      ? items.filter(i => i.item_id !== template.id)
      : [...items, { item_id: template.id, text: template.text }])
  }

  return (
    <div className="space-y-2">
      {availableTemplates.length === 0 ? (
        <p className="text-xs text-gray-400">{emptyLabel}</p>
      ) : availableTemplates.map(template => {
        const included = items.some(i => i.item_id === template.id)
        return (
          <label key={template.id} className="flex items-start gap-2 px-3 py-2 border border-gray-100 rounded-md cursor-pointer hover:bg-gray-50">
            <input type={singleSelect ? 'radio' : 'checkbox'} checked={included} disabled={disabled}
              onChange={() => singleSelect ? selectSingle(template) : toggleItem(template)}
              className={singleSelect ? 'w-4 h-4 mt-0.5 flex-shrink-0' : 'w-4 h-4 rounded mt-0.5 flex-shrink-0'} />
            <span className="text-sm text-gray-700 whitespace-pre-wrap">{template.text}</span>
          </label>
        )
      })}
    </div>
  )
}
