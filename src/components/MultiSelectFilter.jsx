import { useState, useRef, useEffect } from 'react'

// Searchable multi-select checkbox dropdown for inline table filters.
// `selected` is an array of chosen values (empty array = no filter / "All").
// `options` is an array of { value, label } — "Blank" (if the caller
// includes it) is treated as just another real value for OR-matching
// purposes, but is always displayed directly below the pinned "All" /
// "Select All" rows regardless of where it appears in the passed-in list.
export default function MultiSelectFilter({ options, selected, onChange, allLabel, style }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

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
      : `${selected.length} selected`

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          fontSize: 11, border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px',
          background: 'var(--surface)', color: selected.length > 0 ? '#0085C7' : 'var(--text3)',
          cursor: 'pointer', outline: 'none', fontWeight: selected.length > 0 ? 600 : 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: 11, flexShrink: 0 }} />
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
            el.style.left = rect.left + 'px'
            el.style.width = Math.max(rect.width, 180) + 'px'
          }}>
          {options.length > 8 && (
            <div style={{ padding: 6, borderBottom: '1px solid var(--border)' }}>
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                style={{ width: '100%', fontSize: 12, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)', outline: 'none', background: 'var(--surface2)' }} />
            </div>
          )}

          {/* Pinned rows: All (clears + disables filtering), Select All
              (selects every real value), then Blank if the caller supplied
              one — always in this order, never affected by search. */}
          <div style={{ padding: 4, borderBottom: '1px solid var(--border)' }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 6, fontWeight: selected.length === 0 ? 600 : 400 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              onClick={clearAll}>
              <input type="radio" checked={selected.length === 0} onChange={clearAll} />
              <span>{allLabel}</span>
            </label>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: allValues.length === 0 ? 'default' : 'pointer', borderRadius: 6, fontWeight: allSelected ? 600 : 400, opacity: allValues.length === 0 ? 0.5 : 1 }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
              onClick={allValues.length === 0 ? undefined : selectAll}>
              <input type="checkbox" checked={allSelected} disabled={allValues.length === 0} onChange={selectAll} />
              <span>Select All</span>
            </label>
            {blankOption && blankMatchesSearch && (
              <label key={blankOption.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <input type="checkbox" checked={selected.includes(blankOption.value)} onChange={() => toggle(blankOption.value)} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{blankOption.label}</span>
              </label>
            )}
          </div>

          <div style={{ overflowY: 'auto', padding: 4 }}>
            {filteredRegular.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text3)' }}>No matches</div>
            ) : filteredRegular.map(o => (
              <label key={o.value}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', fontSize: 12, cursor: 'pointer', borderRadius: 6 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
                onMouseLeave={e => e.currentTarget.style.background = ''}>
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
