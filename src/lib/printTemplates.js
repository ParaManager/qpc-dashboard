import { qpcLogo } from './logos'

// ── Field mapping architecture ──────────────────────────────────────────
// Templates map to submissions via each form field's stable
// `template_field_key` (set in the form builder), never via displayed
// label text — renaming/translating a label never breaks printing.
// `answerByKey(form, submission, key)` is the single lookup used by every
// template so this stays the one place that needs to change if the
// mapping strategy ever changes.
function answerByKey(form, submission, key) {
  const field = (form.request_form_fields || []).find(f => f.template_field_key === key)
  if (!field) return ''
  const v = submission.answers?.[field.id]
  return Array.isArray(v) ? v.join(', ') : (v ?? '')
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))
}

const STATUS_LABEL = {
  submitted: 'Submitted', under_review: 'Under Review', pending_approval: 'Pending Approval',
  returned: 'Returned', rejected: 'Rejected', approved: 'Approved', completed: 'Completed',
}

function printShell(bodyHtml, title) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'DM Sans', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 24px; }
  .qpc-header { display:flex; align-items:center; gap:14px; border-bottom: 3px solid #0085C7; padding-bottom:12px; margin-bottom:18px; }
  .qpc-header img { height:56px; }
  .qpc-header .titles { flex:1; }
  .qpc-header .titles .en { font-size:18px; font-weight:700; color:#0085C7; }
  .qpc-header .titles .ar { font-size:16px; font-weight:700; direction:rtl; color:#333; }
  .meta-row { display:flex; justify-content:space-between; font-size:12px; color:#555; margin-bottom:16px; }
  .status-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; background:#0085C715; color:#0085C7; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  th, td { border:1px solid #ccc; padding:6px 8px; font-size:12px; text-align:left; vertical-align:top; }
  th { background:#f2f6f9; width:38%; font-weight:600; }
  .section-title { font-size:13px; font-weight:700; color:#0085C7; text-transform:uppercase; letter-spacing:.04em; margin:18px 0 6px; border-bottom:1px solid #0085C7; padding-bottom:3px; }
  .sig-row { display:flex; gap:40px; margin-top:36px; }
  .sig-box { flex:1; border-top:1px solid #333; padding-top:6px; font-size:11px; color:#555; }
  .doc-check { font-size:12px; }
  .yes { color:#009F6B; font-weight:700; }
  .no { color:#EE334E; font-weight:700; }
  @media print { .no-print { display:none; } }
</style></head><body>${bodyHtml}</body></html>`
}

// ── Default QPC template ────────────────────────────────────────────────
// Automatically renders branding, title EN/AR, reference number, submission
// date, submitter, every submitted field/answer, and current status — used
// for every form unless it has an explicit custom template assigned.
function buildDefaultTemplate(form, submission) {
  const fields = (form.request_form_fields || []).slice().sort((a,b) => a.sort_order - b.sort_order)
  const submittedBy = submission.is_guest
    ? `${submission.guest_name || 'Guest'} (Guest)`
    : (submission.profiles?.full_name || '—')

  const rows = fields.map(f => {
    const v = submission.answers?.[f.id]
    const display = Array.isArray(v) ? v.join(', ') : (v ?? '—')
    return `<tr><th>${esc(f.label)}${f.label_ar ? `<br/><span dir="rtl" style="font-weight:400;color:#777">${esc(f.label_ar)}</span>` : ''}</th><td>${esc(display)}</td></tr>`
  }).join('')

  const body = `
    <div class="qpc-header">
      <img src="${qpcLogo}" />
      <div class="titles">
        <div class="en">${esc(form.title)}</div>
        ${form.title_ar ? `<div class="ar">${esc(form.title_ar)}</div>` : ''}
      </div>
    </div>
    <div class="meta-row">
      <span>Reference: <b>${esc(submission.reference_number || submission.id)}</b></span>
      <span>Submitted: <b>${esc(new Date(submission.submitted_at).toLocaleString())}</b></span>
      <span>Status: <span class="status-badge">${esc(STATUS_LABEL[submission.status] || submission.status)}</span></span>
    </div>
    <div class="meta-row"><span>Submitted by: <b>${esc(submittedBy)}</b></span></div>
    <table>${rows}</table>
  `
  return printShell(body, form.title)
}

// ── Custom template: New Athlete Registration Form ─────────────────────
// Recreates the QPC registration PDF layout. Every value is pulled through
// answerByKey() from the saved submission — nothing here is hardcoded.
function buildAthleteRegistrationTemplate(form, submission) {
  const a = key => esc(answerByKey(form, submission, key))
  const hasDoc = key => {
    const field = (form.request_form_fields || []).find(f => f.template_field_key === key)
    const v = field ? submission.answers?.[field.id] : null
    return v ? true : false
  }
  const docRow = (labelEn, labelAr, key) => `
    <tr><td>${esc(labelEn)} <span dir="rtl" style="color:#777">/ ${esc(labelAr)}</span></td>
    <td class="doc-check">${hasDoc(key) ? '<span class="yes">&#10003; Submitted</span>' : '<span class="no">&#10007; Not submitted</span>'}</td></tr>`

  const body = `
    <div class="qpc-header">
      <img src="${qpcLogo}" />
      <div class="titles">
        <div class="en">NEW ATHLETE REGISTRATION FORM</div>
        <div class="ar">استمارة تسجيل لاعب جديد</div>
      </div>
    </div>
    <div class="meta-row">
      <span>Reference: <b>${esc(submission.reference_number || submission.id)}</b></span>
      <span>Date: <b>${a('date') || esc(new Date(submission.submitted_at).toLocaleDateString())}</b></span>
      <span>Status: <span class="status-badge">${esc(STATUS_LABEL[submission.status] || submission.status)}</span></span>
    </div>

    <div class="section-title">Personal Data <span dir="rtl" style="color:#777">/ البيانات الشخصية</span></div>
    <table>
      <tr><th>Full Name (Passport)</th><td>${a('full_name')}</td></tr>
      <tr><th>Gender</th><td>${a('gender')}</td></tr>
      <tr><th>Date of Birth</th><td>${a('dob')}</td></tr>
      <tr><th>Nationality</th><td>${a('nationality')}</td></tr>
      <tr><th>QID Number</th><td>${a('qid')}</td></tr>
      <tr><th>Passport Number</th><td>${a('passport_number')}</td></tr>
      <tr><th>Passport Expiry</th><td>${a('passport_expiry')}</td></tr>
    </table>

    <div class="section-title">Contact Details <span dir="rtl" style="color:#777">/ بيانات التواصل</span></div>
    <table>
      <tr><th>Mobile</th><td>${a('mobile')}</td></tr>
      <tr><th>Email</th><td>${a('email')}</td></tr>
      <tr><th>Address in Qatar</th><td>${a('address')}</td></tr>
      <tr><th>Emergency Contact Name</th><td>${a('emergency_name')}</td></tr>
      <tr><th>Emergency Contact Phone</th><td>${a('emergency_phone')}</td></tr>
      <tr><th>Relationship</th><td>${a('relationship')}</td></tr>
    </table>

    <div class="section-title">Medical / Impairment <span dir="rtl" style="color:#777">/ الحالة الطبية / الإعاقة</span></div>
    <table>
      <tr><th>Impairment Type</th><td>${a('impairment')}</td></tr>
      <tr><th>Assistive Device(s)</th><td>${a('assistive_devices')}</td></tr>
      <tr><th>Notes / Restrictions</th><td>${a('notes')}</td></tr>
    </table>

    <div class="section-title">Document List <span dir="rtl" style="color:#777">/ قائمة المستندات</span></div>
    <table>
      ${docRow('Passport Copy', 'صورة الجواز', 'doc_passport_copy')}
      ${docRow('QID Copy', 'صورة البطاقة الشخصية', 'doc_qid_copy')}
      ${docRow('Personal Photo', 'صورة شخصية', 'doc_personal_photo')}
      ${docRow('Medical Report', 'التقرير الطبي', 'doc_medical_report')}
    </table>

    <div class="section-title">Signatures <span dir="rtl" style="color:#777">/ التوقيعات</span></div>
    <div class="sig-row">
      <div class="sig-box">Athlete / Guardian Name: ${a('guardian_name') || '&nbsp;'}</div>
      <div class="sig-box">Signature: ${a('guardian_signature') || '&nbsp;'}</div>
      <div class="sig-box">Date: ${a('date')}</div>
    </div>
  `
  return printShell(body, 'New Athlete Registration Form')
}

const CUSTOM_TEMPLATES = {
  athlete_registration: buildAthleteRegistrationTemplate,
}

// ── Public entry point ──────────────────────────────────────────────────
// Always reads the CURRENT saved submission (never a cached/duplicated
// copy) and picks the form's assigned template — default QPC layout unless
// the form has an explicit, implemented custom template.
export function buildPrintHtml(form, submission) {
  if (form.print_template === 'custom' && CUSTOM_TEMPLATES[form.custom_template_key]) {
    return CUSTOM_TEMPLATES[form.custom_template_key](form, submission)
  }
  return buildDefaultTemplate(form, submission)
}

function openPrintWindow(html) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.onload = () => { w.focus(); w.print() }
}

// Print and "Download PDF" both render the same up-to-date HTML through the
// browser's native print dialog (Save as PDF) — no separate PDF file is
// generated or stored, so there's nothing to go stale across the workflow.
export function printSubmission(form, submission) {
  openPrintWindow(buildPrintHtml(form, submission))
}
export function downloadSubmissionPdf(form, submission) {
  openPrintWindow(buildPrintHtml(form, submission))
}
