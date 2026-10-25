import { useEffect, useState } from 'react'

// `value`, but only after it has stopped changing for `delay` ms — so a
// search box asks the server once the user pauses, not on every keystroke.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}
