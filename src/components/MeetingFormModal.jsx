import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLang } from '../lib/LangContext.jsx'
import { toast } from './Toast'
import { Avatar } from '../lib/helpers'

export default function MeetingFormModal({ meeting, onClose, onSaved, onDelete, profile }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const isEdit = !!meeting

  const [people, setPeople]         = useState([])
  const [search, setSearch]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [form, setForm] = useState({
    title:       meeting?.title || '',
    date:        meeting?.meeting_date || '',
    startTime:   meeting?.start_time?.slice(0,5) || '',
    endTime:     meeting?.end_time?.slice(0,5) || '',
    location:    meeting?.location || '',
    description: meeting?.description || '',
    attendeeIds: (meeting?.meeting_attendees || []).map(a => a.person_id),
  })

  useEffect(() => {
    supabase.from('people').select('id, name, name_ar').order('name').then(({ data, error }) => {
      if (error) { toast(error.message, 'error'); return }
      setPeople(data || [])
    })
  }, [])

  function toggleAttendee(id) {
    setForm(f => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(id) ? f.attendeeIds.filter(x => x !== id) : [...f.attendeeIds, id],
    }))
  }

  async function handleSave() {
    if (!form.title.trim()) { toast(L('Title required','العنوان مطلوب'), 'error'); return }
    if (!form.date) { toast(L('Date required','التاريخ مطلوب'), 'error'); return }
    if (!form.startTime) { toast(L('Start time required','وقت البدء مطلوب'), 'error'); return }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      meeting_date: form.date,
      start_time: form.startTime,
      end_time: form.endTime || null,
      location: form.location.trim() || null,
      description: form.description.trim() || null,
    }
    let meetingId = meeting?.id
    if (isEdit) {
      const { error } = await supabase.from('meetings').update(payload).eq('id', meetingId)
      if (error) { toast(error.message, 'error'); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('meetings')
        .insert({ ...payload, created_by: profile?.id || null }).select().single()
      if (error) { toast(error.message, 'error'); setSaving(false); return }
      meetingId = data.id
    }

    // Sync attendees: remove all, re-insert current selection (simple + safe for small attendee lists)
    const { error: delErr } = await supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId)
    if (delErr) { toast(delErr.message, 'error'); setSaving(false); return }
    if (form.attendeeIds.length) {
      const { error: insErr } = await supabase.from('meeting_attendees')
        .insert(form.attendeeIds.map(pid => ({ meeting_id: meetingId, person_id: pid })))
      if (insErr) { toast(insErr.message, 'error'); setSaving(false); return }
    }

    setSaving(false)
    toast(isEdit ? L('Meeting updated','تم تحديث الاجتماع') : L('Meeting created','تم إنشاء الاجتماع'))
    onSaved()
  }

  const filteredPeople = people.filter(p => {
    const name = ar && p.name_ar ? p.name_ar : p.name
    return !search || (name || '').toLowerCase().includes(search.toLowerCase())
  })
  const selectedPeople = people.filter(p => form.attendeeIds.includes(p.id))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-sm" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? L('Edit Meeting','تعديل الاجتماع') : L('New Meeting','اجتماع جديد')}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{L('Title','العنوان')} *</label>
            <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
          </div>
          <div className="form-group">
            <label>{L('Date','التاريخ')} *</label>
            <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{L('Start time','وقت البدء')} *</label>
              <input className="form-input" type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>{L('End time','وقت الانتهاء')}</label>
              <input className="form-input" type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label>{L('Location','الموقع')}</label>
            <input className="form-input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>{L('Description','الوصف')}</label>
            <textarea className="form-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>{L('Attendees','الحضور')}</label>
            {selectedPeople.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {selectedPeople.map(p => (
                  <div key={p.id} onClick={() => toggleAttendee(p.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 4px', borderRadius: 999, background: '#0085C715', color: '#0085C7', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    <Avatar name={p.name} id={p.id} size={18} fs={9} />
                    {ar && p.name_ar ? p.name_ar : p.name}
                    <i className="ti ti-x" style={{ fontSize: 12 }} />
                  </div>
                ))}
              </div>
            )}
            <input className="form-input" placeholder={L('Search people…','ابحث عن الأشخاص…')} value={search} onChange={e => setSearch(e.target.value)} />
            <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 9, marginTop: 6 }}>
              {filteredPeople.slice(0, 30).map(p => (
                <div key={p.id} onClick={() => toggleAttendee(p.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13, background: form.attendeeIds.includes(p.id) ? 'var(--surface2)' : 'transparent' }}>
                  <Avatar name={p.name} id={p.id} size={22} fs={10} />
                  <span>{ar && p.name_ar ? p.name_ar : p.name}</span>
                  {form.attendeeIds.includes(p.id) && <i className="ti ti-check" style={{ marginLeft: 'auto', color: '#009F6B' }} />}
                </div>
              ))}
              {filteredPeople.length === 0 && (
                <div style={{ padding: 10, fontSize: 12, color: 'var(--text3)' }}>{L('No matches','لا توجد نتائج')}</div>
              )}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          {isEdit && (
            <button className="btn-cancel" style={{ color: '#dc2626', marginRight: 'auto' }} onClick={() => onDelete(meeting)}>
              {L('Delete','حذف')}
            </button>
          )}
          <button className="btn-cancel" onClick={onClose}>{L('Cancel','إلغاء')}</button>
          <button className="btn btn-blue" disabled={saving} onClick={handleSave}>{saving ? L('Saving…','جاري الحفظ…') : L('Save','حفظ')}</button>
        </div>
      </div>
    </div>
  )
}
