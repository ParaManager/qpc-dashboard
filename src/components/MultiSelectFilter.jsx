import { useState, useRef, useEffect } from 'react'
import { useLang } from '../lib/LangContext.jsx'

// Searchable multi-select checkbox dropdown for inline table filters.
// `selected` is an array of chosen values (empty array = no filter / "All").
// `options` is an array of { value, label } — "Blank" (if the caller
// includes it) is treated as just another real value for OR-matching
// purposes, but is always displayed directly below the pinned "All" /
// "Select All" rows regardless of where it appears in the passed-in list.
export default function MultiSelectFilter({ options, selected, onChange, allLabel, style, counts }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  useEffect(() => {
    if (!open) return
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    function onEscape(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => { document.removeEventListener('mousedown', onOutside); document.removeEventListener('keydown', onEscape) }
  }, [open])

  function toggle(value) {
    const next = selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]
    onChange(next)
  }

  const blankOption = options.find(o => o.value === 'Blank' || o.value === 'blank')
  const regularOptions = options.filter(o => o !== blankOption)

  const filteredRegular = search
    ? regularOptions.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : regularOptions
  const blankMatchesSearch = !search || (blankOption && blankOption.label.toLowerCase().includes(search.toLowerCase()))

  const allValues = regularOptions.map(o => o.value)
  const allSelected = allValues.length > 0 && allValues.every(v => selected.includes(v))

  function selectAll() { onChange(allValues) }
  function clearAll() { onChange([]) }

  const label = selected.length === 0
    ? allLabel
    : selected.length === 1
      ? (options.find(o => o.value === selected[0])?.label || selected[0])
      : L(`${selected.length} selected`, `${selected.length} محدد`)

  return (
    <div ref={ref} className="filter-multiselect" style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
          fontSize: 13, border: '1px solid var(--border)', borderRadius: 9, padding: '8px 12px',
          background: 'var(--surface)', color: 'var(--text)',
          cursor: 'pointer', outline: 'none', fontWeight: 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 13, flexShrink: 0, color: 'var(--text3)' }} />
      </button>
      {open && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', minWidth: 180, maxWidth: 260, maxHeight: 360,
            display: 'flex', flexDirection: 'column',
          }}
          ref={el => {
            if (!el) return
            const btn = el.previousSibling
            const rect = btn?.getBoundingClientRect()
            if (!rect) return

            const spaceBelow = window.innerHeight - rect.bottom
            const dropH = Math.min(360, options.length * 30 + 90)
            if (spaceBelow < dropH + 8) {
              el.style.top = 'auto'; el.style.bottom = (window.innerHeight - rect.top + 4) + 'px'
            } else {
              el.style.top = (rect.bottom + 4) + 'px'; el.style.bottom = 'auto'
            }

            const dropWidth = Math.max(rect.width, 180)
            const viewportW = window.innerWidth
            const margin = 8
            let left = rect.left
            if (left + dropWidth > viewportW - margin) {
              left = rect.right - dropWidth
            }
            left = Math.max(margin, Math.min(left, viewportW - dropWidth - margin))
            el.style.left = left + 'px'
            el.style.width = dropWidth + 'px'
          }}>
          {options.length > 8 && (
            <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={L('Search…', 'بحث…')}
                style={{ width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface2)' }} />
            </div>
          )}

          <div style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: allValues.length === 0 ? 'default' : 'pointer', borderRadius: 6, fontWeight: allSelected ? 600 : 400, opacity: allValues.length === 0 ? 0.5 : 1 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              onClick={allValues.length === 0 ? undefined : (allSelected ? clearAll : selectAll)}>
              <input type="checkbox" checked={allSelected} disabled={allValues.length === 0} onChange={allSelected ? clearAll : selectAll} />
              <span>{L('Select All', 'تحديد الكل')}</span>
            </label>
            {blankOption && blankMatchesSearch && (
              <label key={blankOption.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <input type="checkbox" checked={selected.includes(blankOption.value)} onChange={() => toggle(blankOption.value)} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{blankOption.label}</span>
                {counts && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>({counts[blankOption.value] ?? 0})</span>}
              </label>
            )}
          </div>

          <div style={{ overflowY: 'auto', padding: 4 }}>
            {filteredRegular.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>{L('No matches', 'لا توجد نتائج')}</div>
            ) : filteredRegular.map(o => (
              <label key={o.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{o.label}</span>
                {counts && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>({counts[o.value] ?? 0})</span>}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
