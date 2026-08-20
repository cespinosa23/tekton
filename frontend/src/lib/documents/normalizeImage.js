// pdfmake's PDF renderer (via PDFKit) unreliably handles some PNG variants —
// notably indexed/palette-color PNGs with transparency (color type 3), which
// can render as a solid black box instead of the actual image. Redrawing
// through a canvas flattens any such image into a plain RGBA PNG that
// renders correctly, regardless of how the original was encoded.
export function normalizeImageForPdf(dataUri) {
  if (!dataUri || !dataUri.startsWith('data:image')) return Promise.resolve(dataUri)
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(dataUri) // fall back to the original if canvas access fails
      }
    }
    img.onerror = () => resolve(dataUri)
    img.src = dataUri
  })
}
