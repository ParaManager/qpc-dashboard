import { useState, useRef, useEffect, useCallback } from 'react'
import { useLang } from '../lib/LangContext.jsx'

// Fixed square output size for every uploaded profile photo, regardless of
// the source image's original dimensions — keeps storage/rendering
// consistent across avatars, list rows, PDFs, and ID cards.
const OUTPUT_SIZE = 480
const PREVIEW_SIZE = 280

/**
 * A lightweight crop/zoom step shown before a selected photo is uploaded.
 * The person can drag to reposition and use the slider (or scroll/pinch)
 * to zoom in on the exact part of the photo they want to keep, so a small
 * face in a large photo can be framed properly instead of appearing tiny.
 *
 * Usage: render conditionally when a file is picked, e.g.
 *   {cropFile && (
 *     <PhotoCropModal file={cropFile}
 *       onCancel={() => setCropFile(null)}
 *       onSave={(blob) => { setCropFile(null); handlePhotoUpload(id, blob) }} />
 *   )}
 * onSave receives a File (image/jpeg) that can be passed straight into the
 * existing upload handlers — no changes needed to storage/DB logic.
 */
export default function PhotoCropModal({ file, onCancel, onSave }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [imgUrl, setImgUrl]   = useState(null)
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 })
  const [zoom, setZoom]       = useState(1)
  const [offset, setOffset]   = useState({ x: 0, y: 0 }) // pan, in preview px
  const [saving, setSaving]   = useState(false)
  const dragRef = useRef(null) // { startX, startY, startOffX, startOffY }
  const imgRef  = useRef(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  function onImgLoad(e) {
    setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }

  // Base scale so the shorter side of the image exactly fills the preview
  // circle at zoom = 1 (i.e. no empty gaps at minimum zoom).
  const baseScale = imgSize.w && imgSize.h
    ? PREVIEW_SIZE / Math.min(imgSize.w, imgSize.h)
    : 1
  const scale = baseScale * zoom
  const dispW = imgSize.w * scale
  const dispH = imgSize.h * scale

  const clampOffset = useCallback((x, y, z) => {
    const s = baseScale * z
    const w = imgSize.w * s
    const h = imgSize.h * s
    const maxX = Math.max(0, (w - PREVIEW_SIZE) / 2)
    const maxY = Math.max(0, (h - PREVIEW_SIZE) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) }
  }, [baseScale, imgSize])

  function handlePointerDown(e) {
    const p = e.touches ? e.touches[0] : e
    dragRef.current = { startX: p.clientX, startY: p.clientY, startOffX: offset.x, startOffY: offset.y }
  }
  function handlePointerMove(e) {
    if (!dragRef.current) return
    const p = e.touches ? e.touches[0] : e
    const dx = p.clientX - dragRef.current.startX
    const dy = p.clientY - dragRef.current.startY
    setOffset(clampOffset(dragRef.current.startOffX + dx, dragRef.current.startOffY + dy, zoom))
  }
  function handlePointerUp() { dragRef.current = null }

  function handleWheel(e) {
    e.preventDefault()
    const next = Math.min(4, Math.max(1, zoom - e.deltaY * 0.0015))
    setZoom(next)
    setOffset(o => clampOffset(o.x, o.y, next))
  }

  function handleZoomSlider(e) {
    const next = parseFloat(e.target.value)
    setZoom(next)
    setOffset(o => clampOffset(o.x, o.y, next))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      const ctx = canvas.getContext('2d')

      // Map preview-space geometry (image position/scale/pan) onto the
      // fixed output canvas at OUTPUT_SIZE resolution.
      const outScale = (OUTPUT_SIZE / PREVIEW_SIZE) * scale
      const outW = imgSize.w * outScale
      const outH = imgSize.h * outScale
      const outOffX = offset.x * (OUTPUT_SIZE / PREVIEW_SIZE)
      const outOffY = offset.y * (OUTPUT_SIZE / PREVIEW_SIZE)
      const dx = (OUTPUT_SIZE - outW) / 2 + outOffX
      const dy = (OUTPUT_SIZE - outH) / 2 + outOffY

      ctx.drawImage(imgRef.current, dx, dy, outW, outH)

      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))
      const cropped = new File([blob], (file.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
      onSave(cropped)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-box" style={{ width: 360, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: 'var(--text)' }}>
          {L('Adjust photo', 'ضبط الصورة')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 16 }}>
          {L('Drag to reposition, use the slider to zoom in', 'اسحب لإعادة التموضع، واستخدم الشريط للتكبير')}
        </div>

        <div
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onWheel={handleWheel}
          style={{
            width: PREVIEW_SIZE, height: PREVIEW_SIZE, margin: '0 auto',
            borderRadius: '50%', overflow: 'hidden', position: 'relative',
            background: '#0b0d12', cursor: dragRef.current ? 'grabbing' : 'grab',
            border: '3px solid var(--border)', touchAction: 'none', userSelect: 'none',
          }}
        >
          {imgUrl && (
            <img
              ref={imgRef}
              src={imgUrl}
              onLoad={onImgLoad}
              draggable={false}
              alt=""
              style={{
                position: 'absolute',
                left: `calc(50% - ${dispW / 2}px + ${offset.x}px)`,
                top:  `calc(50% - ${dispH / 2}px + ${offset.y}px)`,
                width: dispW, height: dispH,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 4px 4px' }}>
          <i className="ti ti-zoom-out" style={{ fontSize: 15, color: 'var(--text3)' }} />
          <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={handleZoomSlider}
            style={{ flex: 1 }} />
          <i className="ti ti-zoom-in" style={{ fontSize: 15, color: 'var(--text3)' }} />
        </div>

        <div className="confirm-btns" style={{ marginTop: 18 }}>
          <button className="btn-cancel" onClick={onCancel} disabled={saving}>{L('Cancel', 'إلغاء')}</button>
          <button className="btn" style={{ background: '#0085C7' }} onClick={handleSave} disabled={saving || !imgUrl}>
            {saving ? L('Saving…', 'جارٍ الحفظ…') : L('Save photo', 'حفظ الصورة')}
          </button>
        </div>
      </div>
    </div>
  )
}
