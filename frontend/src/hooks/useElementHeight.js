import { useState, useRef, useCallback } from 'react'

// Measures an element's rendered height live (via ResizeObserver), so a sibling
// can be positioned sticky right below it without a hardcoded pixel offset.
// Uses a callback ref (not useLayoutEffect+useRef) so the observer attaches
// whenever the DOM node actually mounts — not just on the component's first
// commit, which may render a loading/early-return branch without this element.
export function useElementHeight() {
  const [height, setHeight] = useState(0)
  const observerRef = useRef(null)

  const ref = useCallback((el) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (el) {
      const update = () => setHeight(el.offsetHeight)
      update()
      const observer = new ResizeObserver(update)
      observer.observe(el)
      observerRef.current = observer
    }
  }, [])

  return [ref, height]
}
