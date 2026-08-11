import { useRef, useState, useLayoutEffect } from 'react'

// Measures an element's rendered height live (via ResizeObserver), so a sibling
// can be positioned sticky right below it without a hardcoded pixel offset.
export function useElementHeight() {
  const ref = useRef(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setHeight(el.offsetHeight)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, height]
}
