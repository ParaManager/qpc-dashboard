import { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

// Renders every page of a PDF (given as a Blob) onto its own <canvas>,
// stacked vertically in a scrollable container — a fully custom
// presentation with zero native browser PDF chrome (no toolbar, page
// counter, zoom controls, or native download/print icons), unlike an
// <iframe>/<embed> pointed at a PDF blob URL, which Chrome/Edge render
// using their own built-in PDF viewer UI regardless of styling.
export default function PdfCanvasPreview({ blob, className, style }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!blob) return
    let cancelled = false
    let pdfDoc = null
    setLoading(true)
    setError(null)

    async function render() {
      try {
        const arrayBuffer = await blob.arrayBuffer()
        pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        if (cancelled) return
        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) return
          const page = await pdfDoc.getPage(pageNum)
          // Scale to fill the container's width at a crisp resolution
          // (device pixel ratio aware) rather than a fixed arbitrary scale.
          const unscaledViewport = page.getViewport({ scale: 1 })
          const targetWidth = Math.min(container.clientWidth || 800, 1000)
          const scale = (targetWidth / unscaledViewport.width) * (window.devicePixelRatio || 1)
          const viewport = page.getViewport({ scale })

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${targetWidth}px`
          canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`
          canvas.style.display = 'block'
          canvas.style.margin = '0 auto 16px'
          canvas.style.boxShadow = '0 2px 10px rgba(0,0,0,.15)'
          canvas.style.background = '#fff'
          container.appendChild(canvas)

          const ctx = canvas.getContext('2d')
          await page.render({ canvasContext: ctx, viewport }).promise
        }
      } catch (err) {
        console.error('PDF canvas render failed', err)
        if (!cancelled) setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    render()

    return () => {
      cancelled = true
      if (pdfDoc) pdfDoc.destroy()
    }
  }, [blob])

  return (
    <div className={className} style={{ overflowY: 'auto', ...style }}>
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 13 }}>
          Loading preview…
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#EE334E', fontSize: 13 }}>
          Could not render the PDF preview.
        </div>
      )}
      <div ref={containerRef} style={{ padding: '16px 12px', display: loading || error ? 'none' : 'block' }} />
    </div>
  )
}
