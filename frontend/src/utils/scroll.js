// The app's only scrollable region is Layout's <main> (the page body itself
// doesn't scroll) — this resets it to top, e.g. when switching tabs so the
// next tab always opens clean instead of mid-scroll from the previous one.
export function scrollContentToTop() {
  document.getElementById('main-content')?.scrollTo({ top: 0 })
}
