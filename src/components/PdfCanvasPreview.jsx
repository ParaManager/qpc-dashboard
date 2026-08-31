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
//
// PDF.js lifecycle note (pdfjs-dist@6.x): `pdfjsLib.getDocument(...)`
// returns a PDFDocumentLoadingTask synchronously; awaiting `.promise`
// resolves to a PDFDocumentProxy. Only the LOADING TASK has `.destroy()`
// (it aborts network requests and tears down the worker/transport);
// the resolved PDFDocumentProxy does not — it only has `.cleanup()`,
// which frees cached resources but leaves the worker/transport running.
// Calling `.destroy()` on the resolved proxy throws
// "TypeError: ...destroy is not a function", since that method simply
// doesn't exist on it. The loading task reference must be kept
// separately (captured synchronously, before the `await`) so cleanup can
// always call `loadingTask.destroy()` regardless of whether the promise
// has resolved yet.
export default function PdfCanvasPreview({ blob, className, style }) {
  const containerRef = useRef(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Never touches PDF.js at all — no worker/document/task is ever
    // created — unless this component is actually mounted with a real
    // blob to show. Nothing here runs just because the module was
    // imported (e.g. by the Events/Athletes pages that reference this
    // component further down their tree), only when an instance of it
    // is rendered with a valid `blob` prop.
    if (!blob) return

    let cancelled = false
    let loadingTask = null
    let currentRenderTask = null

    async function render() {
      setLoading(true)
      setError(null)
      try {
        const arrayBuffer = await blob.arrayBuffer()
        if (cancelled) return // unmounted while reading the blob

        loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
        const pdfDoc = await loadingTask.promise
        if (cancelled) {
          // Unmounted (or blob changed) while the document was loading —
          // the loading task itself is destroyed in the cleanup function
          // below; nothing further to do with the now-resolved document.
          return
        }

        const container = containerRef.current
        if (!container) return
        container.innerHTML = ''

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) return

          const page = await pdfDoc.getPage(pageNum)
          if (cancelled) return

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
          currentRenderTask = page.render({ canvasContext: ctx, viewport })
          try {
            await currentRenderTask.promise
          } catch (renderErr) {
            // A cancelled RenderTask rejects its promise by design — not
            // a real failure, just the expected outcome of unmounting or
            // the blob changing mid-page-render.
            if (renderErr?.name === 'RenderingCancelledException') return
            throw renderErr
          } finally {
            currentRenderTask = null
          }
        }
      } catch (err) {
        if (cancelled) return
        console.error('PDF canvas render failed', err)
        setError(err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    render()

    return () => {
      cancelled = true
      // Abort whatever page render is currently in flight so it doesn't
      // keep drawing onto a canvas this component is about to discard.
      if (currentRenderTask) {
        try { currentRenderTask.cancel() } catch { /* already settled */ }
      }
      // Destroy the LOADING TASK (aborts the fetch if still in progress,
      // and tears down the worker/document/transport once it resolves) —
      // this is the one object in this lifecycle that actually owns
      // `.destroy()`; the resolved PDFDocumentProxy does not.
      if (loadingTask) {
        loadingTask.destroy().catch(() => { /* teardown errors are not actionable here */ })
      }
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
