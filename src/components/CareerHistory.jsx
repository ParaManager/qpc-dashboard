import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from './Toast'
import { SPORTS, SPORT_NAMES_AR } from '../lib/helpers'

const SPORT_AR = SPORT_NAMES_AR

export default function CareerHistory({ personId, personType, personName, readOnly }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en

  const [entries, setEntries]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editData, setEditData] = useState(null)
  const [forceExpanded, setForceExpanded] = useState(false)

  useEffect(() => { if (personId) load() }, [personId])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('career_history')
      .select('*')
      .eq('person_id', String(personId))
      .order('start_date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function save(form) {
    const payload = {
      person_id:     String(personId),
      person_type:   personType,
      role:          form.role || null,
      role_ar:       form.role_ar || null,
      sport:         form.sport || null,
      club:          form.club || null,
      start_date:    form.start_date || null,
      end_date:      form.is_current ? null : (form.end_date || null),
      is_current:    !!form.is_current,
      medals_gold:   parseInt(form.medals_gold) || 0,
      medals_silver: parseInt(form.medals_silver) || 0,
      medals_bronze: parseInt(form.medals_bronze) || 0,
      notes:         form.notes || null,
    }
    if (form.id) {
      const { error } = await supabase.from('career_history').update(payload).eq('id', form.id)
      if (error) { toast(error.message, 'error'); return }
    } else {
      const { error } = await supabase.from('career_history').insert(payload)
      if (error) { toast(error.message, 'error'); return }
    }
    toast(form.id ? L('Updated', 'تم التحديث') : L('Career entry added', 'تم إضافة السجل'))
    setShowForm(false); setEditData(null); load()
  }

  async function remove(id) {
    await supabase.from('career_history').delete().eq('id', id)
    toast(L('Deleted', 'تم الحذف'))
    load()
  }

  const totalMedals = entries.reduce((s, e) => ({
    gold:   s.gold   + (e.medals_gold   || 0),
    silver: s.silver + (e.medals_silver || 0),
    bronze: s.bronze + (e.medals_bronze || 0),
  }), { gold: 0, silver: 0, bronze: 0 })

  const isEmpty = !loading && entries.length === 0
  const collapsed = isEmpty && !forceExpanded && !showForm

  if (collapsed) {
    return (
      <div className="info-card" style={{ marginTop: 0, padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)' }}>
            <i className="ti ti-timeline" />
            {L('Career History', 'السيرة المهنية')}
            <span style={{ fontStyle: 'italic' }}>— {L('none yet', 'لا يوجد بعد')}</span>
          </div>
          {!readOnly && (
            <button className="btn" style={{ background: '#0085C7', fontSize: 12, padding: '5px 12px', flexShrink: 0 }}
              onClick={() => { setEditData(null); setShowForm(true); setForceExpanded(true) }}>
              <i className="ti ti-plus" /> {L('Add entry', 'إضافة')}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="info-card" style={{ marginTop: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="info-title" style={{ margin: 0 }}>
          <i className="ti ti-timeline" style={{ marginRight: 6 }} />
          {L('Career History', 'السيرة المهنية')}
        </div>
        {!readOnly && <button className="btn" style={{ background: '#0085C7', fontSize: 12, padding: '5px 12px' }}
          onClick={() => { setEditData(null); setShowForm(true) }}>
          <i className="ti ti-plus" /> {L('Add entry', 'إضافة')}
        </button>}
      </div>

      {/* Total medals across career */}
      {(totalMedals.gold + totalMedals.silver + totalMedals.bronze) > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, padding: '12px 16px', background: 'var(--surface2)', borderRadius: 10 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#f1c40f' }}>{totalMedals.gold}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{L('Gold', 'ذهب')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#aaa' }}>{totalMedals.silver}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{L('Silver', 'فضة')}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#cd7f32' }}>{totalMedals.bronze}</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>{L('Bronze', 'برونز')}</div>
          </div>
          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 16, display: 'flex', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{totalMedals.gold + totalMedals.silver + totalMedals.bronze}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>{L('Total medals', 'إجمالي الميداليات')}</div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="empty">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="empty">{L('No career history yet', 'لا يوجد سجل مهني بعد')}</div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{ position: 'absolute', left: ar ? 'auto' : 16, right: ar ? 16 : 'auto', top: 8, bottom: 8, width: 2, background: 'var(--border)' }} />
          {entries.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', gap: 16, marginBottom: 20, position: 'relative', paddingLeft: ar ? 0 : 40, paddingRight: ar ? 40 : 0 }}>
              {/* Timeline dot */}
              <div style={{
                position: 'absolute', left: ar ? 'auto' : 10, right: ar ? 10 : 'auto',
                top: 4, width: 14, height: 14, borderRadius: '50%',
                background: e.is_current ? '#009F6B' : '#0085C7',
                border: '2px solid var(--surface)', zIndex: 1,
                boxShadow: e.is_current ? '0 0 0 3px #009F6B30' : 'none'
              }} />
              {/* Card */}
              <div style={{ flex: 1, background: 'var(--surface2)', borderRadius: 12, padding: '12px 14px', border: e.is_current ? '1px solid #009F6B40' : '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {ar && e.role_ar ? e.role_ar : (e.role || L('No title', 'بدون مسمى'))}
                      {e.is_current && <span style={{ marginLeft: 8, fontSize: 10, background: '#009F6B20', color: '#009F6B', padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>{L('Current', 'حالي')}</span>}
                    </div>
                    {e.sport && <div style={{ fontSize: 12, color: '#0085C7', marginTop: 2 }}>{ar ? (SPORT_AR[e.sport] || e.sport) : e.sport}</div>}
                    {e.club && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{e.club}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: ar ? 'left' : 'right' }}>
                    {e.start_date && <div>{e.start_date}</div>}
                    {!e.is_current && e.end_date && <div>→ {e.end_date}</div>}
                    {e.is_current && <div style={{ color: '#009F6B' }}>→ {L('Present', 'الآن')}</div>}
                  </div>
                </div>
                {/* Medals for this period */}
                {(e.medals_gold || e.medals_silver || e.medals_bronze) ? (
                  <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 12 }}>
                    {e.medals_gold   > 0 && <span>🥇 {e.medals_gold}</span>}
                    {e.medals_silver > 0 && <span>🥈 {e.medals_silver}</span>}
                    {e.medals_bronze > 0 && <span>🥉 {e.medals_bronze}</span>}
                  </div>
                ) : null}
                {e.notes && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>{e.notes}</div>}
                {/* Actions */}
                {!readOnly && <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button onClick={() => { setEditData(e); setShowForm(true) }}
                    style={{ fontSize: 11, padding: '3px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text2)' }}>
                    <i className="ti ti-pencil" /> {L('Edit', 'تعديل')}
                  </button>
                  <button onClick={() => remove(e.id)}
                    style={{ fontSize: 11, padding: '3px 10px', background: '#EE334E10', border: '1px solid #EE334E30', borderRadius: 6, cursor: 'pointer', color: '#EE334E' }}>
                    <i className="ti ti-trash" /> {L('Delete', 'حذف')}
                  </button>
                </div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <CareerForm
          data={editData}
          ar={ar}
          onSave={save}
          onClose={() => { setShowForm(false); setEditData(null) }}
        />
      )}
    </div>
  )
}

function CareerForm({ data, ar, onSave, onClose }) {
  const [form, setForm] = useState(data || { is_current: false, medals_gold: 0, medals_silver: 0, medals_bronze: 0 })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const L = (en, a) => ar ? a : en
  const inp = (name, type='text', placeholder='') => (
    <input className="form-input" type={type} placeholder={placeholder}
      value={form[name] || ''} onChange={e => set(name, e.target.value)} />
  )
  const grp = (label, field) => (
    <div className="form-group"><label className="form-label">{label}</label>{field}</div>
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{data?.id ? L('Edit Career Entry', 'تعديل سجل مهني') : L('Add Career Entry', 'إضافة سجل مهني')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-section">{L('Role / Position', 'الدور / المسمى')}</div>
          <div className="form-row">
            {grp(L('Role (English)', 'الدور (إنجليزي)'), inp('role', 'text', 'e.g. Head Coach'))}
            {grp(L('Role (Arabic)', 'الدور (عربي)'), inp('role_ar', 'text', 'e.g. مدرب رئيسي'))}
          </div>
          <div className="form-row">
            {grp(L('Sport', 'الرياضة'),
              <select className="form-input" value={form.sport || ''} onChange={e => set('sport', e.target.value)}>
                <option value=""></option>
                {SPORTS.map(s => <option key={s} value={s}>{ar ? (SPORT_AR[s] || s) : s}</option>)}
              </select>
            )}
            {grp(L('Club / Organization', 'النادي / المنظمة'), inp('club', 'text', 'e.g. Qatar Paralympic Committee'))}
          </div>

          <div className="form-section">{L('Period', 'الفترة')}</div>
          <div className="form-row">
            {grp(L('Start date', 'تاريخ البداية'), inp('start_date', 'date'))}
            {!form.is_current && grp(L('End date', 'تاريخ النهاية'), inp('end_date', 'date'))}
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="is_current" checked={!!form.is_current} onChange={e => set('is_current', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="is_current" style={{ cursor: 'pointer', fontSize: 13 }}>{L('This is my current role', 'هذا دوري الحالي')}</label>
          </div>

          <div className="form-section">{L('Medals during this period', 'الميداليات خلال هذه الفترة')}</div>
          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            {grp('🥇 ' + L('Gold', 'ذهب'), inp('medals_gold', 'number', '0'))}
            {grp('🥈 ' + L('Silver', 'فضة'), inp('medals_silver', 'number', '0'))}
            {grp('🥉 ' + L('Bronze', 'برونز'), inp('medals_bronze', 'number', '0'))}
          </div>

          <div className="form-group">
            <label className="form-label">{L('Notes', 'ملاحظات')}</label>
            <textarea className="form-input" rows={2} value={form.notes || ''} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{L('Cancel', 'إلغاء')}</button>
          <button className="btn" style={{ background: '#0085C7' }} onClick={() => onSave(form)}>
            {data?.id ? L('Save changes', 'حفظ التغييرات') : L('Add entry', 'إضافة')}
          </button>
        </div>
      </div>
    </div>
  )
}
