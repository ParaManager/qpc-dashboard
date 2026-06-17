import { useState, useEffect, useCallback } from 'react'

// ── TOAST ──────────────────────────────────────────────
let _toastFn = null
export function useToast() { return _toastFn }

export function ToastContainer() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'success') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200)
  }, [])
  useEffect(() => { _toastFn = add }, [add])
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <i className={`ti ti-${t.type === 'success' ? 'circle-check' : 'alert-circle'}`} />
          {t.msg}
        </div>
      ))}
    </div>
  )
}

export function toast(msg, type = 'success') { _toastFn?.(msg, type) }

// ── CONFIRM MODAL ───────────────────────────────────────
export function ConfirmModal({ title, message, onConfirm, onCancel, danger = true, confirmLabel, cancelLabel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon">⚠️</div>
        <div className="confirm-title">{title}</div>
        <div className="confirm-msg">{message}</div>
        <div className="confirm-btns">
          <button className="btn-cancel" onClick={onCancel}>{cancelLabel || 'Cancel'}</button>
          <button className="btn" style={{ background: danger ? '#dc2626' : '#0085C7' }} onClick={onConfirm}>
            {confirmLabel || (danger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
