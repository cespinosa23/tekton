import { useState } from 'react'
import { Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react'
import MultiSelectCombobox from '../MultiSelectCombobox'

const inp = 'px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400'

export default function SowEditor({ items: itemsProp, onChange, sowTypes = [], disabled = false }) {
  const items = itemsProp || []
  const [noteDrafts, setNoteDrafts] = useState({})
  const [notesOpen, setNotesOpen] = useState({})

  const availableTypes = sowTypes.filter(t => !t.archived)
  const selectedTypeIds = items.map(t => t.sow_type_id)

  const handleTypeSelectionChange = (newIds) => {
    const newIdSet = new Set(newIds)
    const kept = items.filter(t => newIdSet.has(t.sow_type_id))
    const keptIds = new Set(kept.map(t => t.sow_type_id))
    const added = newIds.filter(id => !keptIds.has(id)).map(id => {
      const type = sowTypes.find(t => t.id === id)
      return { sow_type_id: id, sow_type_name: type?.name || '', sub_items: [] }
    })
    onChange([...kept, ...added])
  }

  const removeType = (typeId) => {
    if (disabled) return
    onChange(items.filter(t => t.sow_type_id !== typeId))
  }

  const toggleSubItem = (typeId, subItem) => {
    if (disabled) return
    onChange(items.map(t => {
      if (t.sow_type_id !== typeId) return t
      const has = t.sub_items.some(si => si.item_id === subItem.id)
      return {
        ...t,
        sub_items: has
          ? t.sub_items.filter(si => si.item_id !== subItem.id)
          : [...t.sub_items, { item_id: subItem.id, item_name: subItem.item_name, notes: [] }],
      }
    }))
  }

  const noteKey = (typeId, itemId) => `${typeId}-${itemId}`

  const isNotesOpen = (key, notesLen) => notesOpen[key] ?? (notesLen === 0)
  const toggleNotesOpen = (key, notesLen) => setNotesOpen(p => ({ ...p, [key]: !isNotesOpen(key, notesLen) }))

  const addNote = (typeId, itemId) => {
    const key = noteKey(typeId, itemId)
    const note = (noteDrafts[key] || '').trim()
    if (!note) return
    onChange(items.map(t => t.sow_type_id !== typeId ? t : {
      ...t,
      sub_items: t.sub_items.map(si => si.item_id !== itemId ? si : { ...si, notes: [...si.notes, note] }),
    }))
    setNoteDrafts(p => ({ ...p, [key]: '' }))
    setNotesOpen(p => ({ ...p, [key]: true }))
  }

  const removeNote = (typeId, itemId, noteIdx) => {
    if (disabled) return
    onChange(items.map(t => t.sow_type_id !== typeId ? t : {
      ...t,
      sub_items: t.sub_items.map(si => si.item_id !== itemId ? si : { ...si, notes: si.notes.filter((_, i) => i !== noteIdx) }),
    }))
  }

  return (
    <div className="space-y-4">
      {/* Type picker */}
      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Select Scope of Work types to include</p>
        {availableTypes.length === 0 ? (
          <p className="text-xs text-gray-400">No Scope of Work types set up yet — add some in Settings first.</p>
        ) : (
          <MultiSelectCombobox
            options={availableTypes}
            selectedIds={selectedTypeIds}
            onChange={handleTypeSelectionChange}
            placeholder="Select Scope of Work types..."
            getLabel={t => t.name}
            getId={t => t.id}
            disabled={disabled}
          />
        )}
      </div>

      {/* Selected types with sub-items + notes */}
      {items.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
          No Scope of Work types selected yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(t => {
            const fullType = sowTypes.find(st => st.id === t.sow_type_id)
            const availableSubItems = fullType?.items || []
            return (
              <div key={t.sow_type_id} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-sm font-semibold text-gray-800">{t.sow_type_name}</span>
                  {!disabled && (
                    <button onClick={() => removeType(t.sow_type_id)} className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  {availableSubItems.length === 0 ? (
                    <p className="text-xs text-gray-400">This type has no sub-items set up in Settings yet.</p>
                  ) : availableSubItems.map(subItem => {
                    const included = t.sub_items.find(si => si.item_id === subItem.id)
                    const key = noteKey(t.sow_type_id, subItem.id)
                    const notesLen = included?.notes.length || 0
                    const notesShown = included && isNotesOpen(key, notesLen)
                    return (
                      <div key={subItem.id} className="border border-gray-100 rounded-md">
                        <label className="flex items-start gap-2 px-3 py-2 cursor-pointer">
                          <input type="checkbox" checked={!!included} disabled={disabled}
                            onChange={() => toggleSubItem(t.sow_type_id, subItem)}
                            className="w-4 h-4 rounded mt-0.5 flex-shrink-0" />
                          <span
                            title={!included ? subItem.item_name : undefined}
                            className={`text-sm text-gray-700 whitespace-pre-wrap ${!included ? 'line-clamp-2' : ''}`}>
                            {subItem.item_name}
                          </span>
                        </label>
                        {included && (
                          <div className="px-3 pb-2.5 border-t border-gray-100">
                            <button onClick={() => toggleNotesOpen(key, notesLen)}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 pt-2 pb-1">
                              {notesShown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {notesLen === 0 ? 'Add a note' : `${notesLen} note${notesLen > 1 ? 's' : ''}`}
                            </button>
                            {notesShown && (
                              <div className="pt-1">
                                {notesLen > 0 && (
                                  <ul className="space-y-1 mb-2">
                                    {included.notes.map((note, i) => (
                                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1.5">
                                        <span className="flex-1 whitespace-pre-wrap">{note}</span>
                                        {!disabled && (
                                          <button onClick={() => removeNote(t.sow_type_id, subItem.id, i)}
                                            className="text-gray-400 hover:text-red-500 flex-shrink-0"><X size={12} /></button>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {!disabled && (
                                  <div className="flex gap-2">
                                    <input value={noteDrafts[key] || ''}
                                      onChange={e => setNoteDrafts(p => ({ ...p, [key]: e.target.value }))}
                                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addNote(t.sow_type_id, subItem.id))}
                                      placeholder="Add a note…"
                                      className={`${inp} flex-1`} />
                                    <button onClick={() => addNote(t.sow_type_id, subItem.id)}
                                      disabled={!(noteDrafts[key] || '').trim()}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-900 text-white rounded text-xs hover:bg-gray-700 disabled:opacity-50">
                                      <Plus size={12} /> Add
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
