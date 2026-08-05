import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { toast } from './Toast'

// Manages one athlete's rows in the athlete_sports junction table — the
// source of truth for multi-sport / per-sport-coach assignments. Sport
// Category is never stored here; it's always read from sports.category
// via the join, per the data model requirement.
export default function AthleteSportsCard({ athlete, coaches, sportsList, lang, profile, onChanged }) {
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const editable = canEdit(profile)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newSportId, setNewSportId] = useState('')
  const [newCoachId, setNewCoachId] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editCoachId, setEditCoachId] = useState('')

  async function load() {
    if (!athlete?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('athlete_sports')
      .select('id, sport_id, coach_id, sports(id, name, category), coaches(id, name, name_ar)')
      .eq('athlete_id', athlete.id)
      .order('id')
    if (error) { toast(error.message, 'error'); setLoading(false); return }
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [athlete?.id])

  const assignedSportIds = new Set(rows.map(r => r.sport_id))
  const availableSports = (sportsList || []).filter(s => !assignedSportIds.has(s.id))
  // Only offer coaches whose own sport matches the sport being assigned —
  // same relevance filtering the rest of the app already uses elsewhere.
  const coachesForSport = (sportId) => {
    const sport = (sportsList || []).find(s => s.id === Number(sportId))
    if (!sport) return coaches || []
    return (coaches || []).filter(c => !c.sport || c.sport === sport.name || `Para ${c.sport}` === sport.name || `SO ${c.sport}` === sport.name)
  }

  async function addAssignment() {
    if (!newSportId) return
    const { error } = await supabase.from('athlete_sports').insert({
      athlete_id: athlete.id,
      sport_id: Number(newSportId),
      coach_id: newCoachId ? Number(newCoachId) : null,
    })
    if (error) { toast(error.message, 'error'); return }
    toast(L('Sport added', 'تمت إضافة الرياضة'))
    setAdding(false); setNewSportId(''); setNewCoachId('')
    await load(); onChanged?.()
  }

  async function saveCoach(rowId) {
    const { error } = await supabase.from('athlete_sports').update({ coach_id: editCoachId ? Number(editCoachId) : null }).eq('id', rowId)
    if (error) { toast(error.message, 'error'); return }
    setEditingId(null)
    await load(); onChanged?.()
  }

  async function removeAssignment(rowId) {
    const { error } = await supabase.from('athlete_sports').delete().eq('id', rowId)
    if (error) { toast(error.message, 'error'); return }
    toast(L('Sport removed', 'تمت إزالة الرياضة'))
    await load(); onChanged?.()
  }

  return (
    <div className="info-card">
      <div className="info-title" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{L('Sports', 'الرياضات')} ({rows.length})</span>
        {editable && !adding && (
          <button onClick={() => setAdding(true)} style={{ fontSize: 12, color: '#0085C7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <i className="ti ti-plus" /> {L('Add sport', 'إضافة رياضة')}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>{L('Loading…', 'جارٍ التحميل…')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map(r => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12.5 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{r.sports?.name || '—'}</div>
                <div style={{ color: 'var(--text3)', fontSize: 11 }}>{r.sports?.category || '—'}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === r.id ? (
                  <select value={editCoachId} onChange={e => setEditCoachId(e.target.value)} className="form-input" style={{ fontSize: 12, padding: '4px 8px' }}>
                    <option value="">{L('— No coach —', '— بدون مدرب —')}</option>
                    {coachesForSport(r.sport_id).map(c => <option key={c.id} value={c.id}>{ar && c.name_ar ? c.name_ar : c.name}</option>)}
                  </select>
                ) : (
                  <span>{ar && r.coaches?.name_ar ? r.coaches.name_ar : (r.coaches?.name || L('Unassigned', 'غير معين'))}</span>
                )}
              </div>
              {editable && (
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {editingId === r.id ? (
                    <>
                      <button onClick={() => saveCoach(r.id)} title={L('Save', 'حفظ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#009F6B' }}><i className="ti ti-check" /></button>
                      <button onClick={() => setEditingId(null)} title={L('Cancel', 'إلغاء')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><i className="ti ti-x" /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setEditingId(r.id); setEditCoachId(r.coach_id ? String(r.coach_id) : '') }} title={L('Edit coach', 'تعديل المدرب')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}><i className="ti ti-edit" /></button>
                      <button onClick={() => removeAssignment(r.id)} title={L('Remove', 'إزالة')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><i className="ti ti-trash" /></button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {rows.length === 0 && <div className="empty">{L('No sports assigned', 'لا توجد رياضات معينة')}</div>}

          {adding && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', border: '1px dashed var(--border)', borderRadius: 8 }}>
              <select value={newSportId} onChange={e => { setNewSportId(e.target.value); setNewCoachId('') }} className="form-input" style={{ fontSize: 12, padding: '4px 8px', flex: 1 }}>
                <option value="">{L('— Select sport —', '— اختر الرياضة —')}</option>
                {availableSports.map(s => <option key={s.id} value={s.id}>{s.name} ({s.category})</option>)}
              </select>
              <select value={newCoachId} onChange={e => setNewCoachId(e.target.value)} className="form-input" style={{ fontSize: 12, padding: '4px 8px', flex: 1 }} disabled={!newSportId}>
                <option value="">{L('— No coach —', '— بدون مدرب —')}</option>
                {coachesForSport(newSportId).map(c => <option key={c.id} value={c.id}>{ar && c.name_ar ? c.name_ar : c.name}</option>)}
              </select>
              <button onClick={addAssignment} disabled={!newSportId} style={{ background: '#0085C7', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>{L('Add', 'إضافة')}</button>
              <button onClick={() => { setAdding(false); setNewSportId(''); setNewCoachId('') }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>{L('Cancel', 'إلغاء')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
