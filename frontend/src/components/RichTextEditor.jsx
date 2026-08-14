import { useRef, useEffect } from 'react'
import { Bold, Italic, List, ListOrdered } from 'lucide-react'
import DOMPurify from 'dompurify'

const SANITIZE_OPTS = { ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'br', 'p', 'div', 'span'], ALLOWED_ATTR: [] }
export const sanitizeRichText = (html) => DOMPurify.sanitize(html || '', SANITIZE_OPTS)

// Minimal contentEditable-based rich text editor (bold/italic/lists only, per
// spec) — no external editor library in this project yet, and pulling one in
// for just these four commands would be a heavier dependency than warranted.
export default function RichTextEditor({ value, onChange, disabled = false, placeholder = '' }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    const clean = sanitizeRichText(value)
    if (ref.current.innerHTML !== clean && document.activeElement !== ref.current) {
      ref.current.innerHTML = clean
    }
  }, [value])

  const exec = (command) => {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(command, false, null)
    onChange(sanitizeRichText(ref.current.innerHTML))
  }

  const toolbarBtn = (Icon, command, title) => (
    <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => exec(command)}
      title={title} disabled={disabled}
      className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent">
      <Icon size={15} />
    </button>
  )

  return (
    <div className={`border rounded-md ${disabled ? 'bg-gray-50 border-gray-200' : 'border-gray-300'}`}>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 rounded-t-md">
        {toolbarBtn(Bold, 'bold', 'Bold')}
        {toolbarBtn(Italic, 'italic', 'Italic')}
        {toolbarBtn(List, 'insertUnorderedList', 'Bulleted list')}
        {toolbarBtn(ListOrdered, 'insertOrderedList', 'Numbered list')}
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={e => onChange(sanitizeRichText(e.currentTarget.innerHTML))}
        data-placeholder={placeholder}
        className="min-h-[160px] px-3 py-2 text-sm text-gray-800 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
      />
    </div>
  )
}
