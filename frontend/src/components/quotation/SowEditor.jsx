import { useState } from 'react'
import { Plus, Trash2, X, ChevronDown, ChevronUp, GripVertical } from 'lucide-react'
import MultiSelectCombobox from '../MultiSelectCombobox'

const inp = 'px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400'

// The checklist's display order is per-quotation (t.item_order), separate
// from the Settings-defined master order on the SOW type itself — dragging
// in one quotation must never reorder another quotation's checklist, or the
// master list everyone else's quotations start from. Falls back to the
// master order for any item that hasn't been explicitly placed yet (a fresh
// scope item, or one added to the type in Settings after this quotation's
// order was last saved), appended after the ones that have.
export const getOrderedIds = (t, fullType) => {
  const allIds = (fullType?.items || []).map(i => i.id)
  const known = (t.item_order || []).filter(id => allIds.includes(id))
  const missing = allIds.filter(id => !known.includes(id))
  return [...known, ...missing]
}

// Keeps sub_items (the checked-in items actually rendered on the document —
// see buildQuotationIR/QuotePreview, which just iterate this array as-is)
// in the same order as the checklist, so dragging the checklist changes the
// printed order too without needing any changes on the document side.
export const reorderSubItems = (subItems, orderedIds) =>
  orderedIds.map(id => subItems.find(si => si.item_id === id)).filter(Boolean)

export default function SowEditor({ items: itemsProp, onChange, sowTypes = [], disabled = false }) {
  const items = itemsProp || []
  const [noteDrafts, setNoteDrafts] = useState({})
  const [notesOpen, setNotesOpen] = useState({})
  const [dragging, setDragging] = useState(null) // { typeId, itemId }

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
      const fullType = sowTypes.find(st => st.id === typeId)
      const has = t.sub_items.some(si => si.item_id === subItem.id)
      const newSubItems = has
        ? t.sub_items.filter(si => si.item_id !== subItem.id)
        : [...t.sub_items, { item_id: subItem.id, item_name: subItem.item_name, notes: [] }]
      // Re-sort by the checklist's own order so a newly-checked item lands
      // where it visually sits, not always at the end.
      return { ...t, sub_items: reorderSubItems(newSubItems, getOrderedIds(t, fullType)) }
    }))
  }

  const reorderItem = (typeId, draggedItemId, targetItemId) => {
    if (disabled || draggedItemId === targetItemId) return
    onChange(items.map(t => {
      if (t.sow_type_id !== typeId) return t
      const fullType = sowTypes.find(st => st.id === typeId)
      const order = getOrderedIds(t, fullType)
      const from = order.indexOf(draggedItemId)
      const to = order.indexOf(targetItemId)
      if (from === -1 || to === -1) return t
      const nextOrder = [...order]
      nextOrder.splice(from, 1)
      nextOrder.splice(to, 0, draggedItemId)
      return { ...t, item_order: nextOrder, sub_items: reorderSubItems(t.sub_items, nextOrder) }
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
            const orderedSubItems = getOrderedIds(t, fullType)
              .map(id => (fullType?.items || []).find(si => si.id === id))
              .filter(Boolean)
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
                  {orderedSubItems.length === 0 ? (
                    <p className="text-xs text-gray-400">This type has no sub-items set up in Settings yet.</p>
                  ) : orderedSubItems.map(subItem => {
                    const included = t.sub_items.find(si => si.item_id === subItem.id)
                    const key = noteKey(t.sow_type_id, subItem.id)
                    const notesLen = included?.notes.length || 0
                    const notesShown = included && isNotesOpen(key, notesLen)
                    const isDragTarget = dragging && dragging.typeId === t.sow_type_id && dragging.itemId !== subItem.id
                    return (
                      <div key={subItem.id}
                        draggable={!disabled}
                        onDragStart={disabled ? undefined : (e) => {
                          // Firefox requires dataTransfer.setData() in
                          // dragstart or the drag never actually begins (no
                          // dragover/drop fires) — Chrome/Edge are lenient
                          // about this, which is why it worked there without it.
                          e.dataTransfer.setData('text/plain', String(subItem.id))
                          e.dataTransfer.effectAllowed = 'move'
                          setDragging({ typeId: t.sow_type_id, itemId: subItem.id })
                        }}
                        onDragEnd={disabled ? undefined : () => setDragging(null)}
                        onDragOver={disabled ? undefined : (e) => { if (isDragTarget) e.preventDefault() }}
                        onDrop={disabled ? undefined : (e) => {
                          e.preventDefault()
                          if (dragging) reorderItem(t.sow_type_id, dragging.itemId, subItem.id)
                          setDragging(null)
                        }}
                        className={`border rounded-md transition-colors ${isDragTarget ? 'border-gray-400 bg-gray-50' : 'border-gray-100'}`}>
                        <label className="flex items-start gap-2 px-3 py-2 cursor-pointer">
                          {!disabled && (
                            <GripVertical size={14} className="text-gray-300 mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing" />
                          )}
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
