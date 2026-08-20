import { qpcLogo } from './logos'
import { supabase } from './supabase'

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
  .qpc-header { display:flex; align-items:center; gap:14px; border-bottom: 3px solid #0085C7; padding-bottom:12px; margin-bottom:18px; break-inside:avoid; page-break-inside:avoid; }
  .qpc-header img { height:56px; }
  .qpc-header .titles { flex:1; }
  .qpc-header .titles .en { font-size:18px; font-weight:700; color:#0085C7; }
  .qpc-header .titles .ar { font-size:16px; font-weight:700; direction:rtl; color:#333; }
  .meta-row { display:flex; justify-content:space-between; font-size:12px; color:#555; margin-bottom:16px; break-inside:avoid; page-break-inside:avoid; }
  .status-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; background:#0085C715; color:#0085C7; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  thead { display: table-header-group; } /* repeat header row on each printed page where the browser supports it */
  tr { break-inside:avoid; page-break-inside:avoid; }
  th, td { border:1px solid #ccc; padding:6px 8px; font-size:12px; text-align:left; vertical-align:top; }
  th { background:#f2f6f9; width:38%; font-weight:600; }
  .section-title { font-size:13px; font-weight:700; color:#0085C7; text-transform:uppercase; letter-spacing:.04em; margin:18px 0 6px; border-bottom:1px solid #0085C7; padding-bottom:3px; break-after:avoid; page-break-after:avoid; }
  /* Keeps a section title glued to whatever immediately follows it (its
     first row/table), so a title never ends up alone at the bottom of a
     page with its content pushed to the next one. */
  .section-title + table, .section-title + .sig-row { break-before:avoid; page-break-before:avoid; }
  .sig-row { display:flex; gap:40px; margin-top:36px; break-inside:avoid; page-break-inside:avoid; }
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
function buildDefaultTemplate(form, submission, signatureUrls = {}) {
  const fields = (form.request_form_fields || []).slice().sort((a,b) => a.sort_order - b.sort_order)
  const submittedBy = submission.is_guest
    ? `${submission.guest_name || 'Guest'} (Guest)`
    : (submission.profiles?.full_name || '—')

  const rows = fields.map(f => {
    // Signature fields render the actual captured image, not the stored
    // filename marker — signatureUrls is pre-fetched (signed URLs) before
    // this template is built, since this function itself stays sync.
    if (f.field_type === 'signature') {
      const url = signatureUrls[f.id]
      const cell = url
        ? `<img src="${esc(url)}" style="max-width:220px;max-height:90px;border:1px solid #ddd;border-radius:4px;background:#fff;" />`
        : '—'
      return `<tr><th>${esc(f.label)}${f.label_ar ? `<br/><span dir="rtl" style="font-weight:400;color:#777">${esc(f.label_ar)}</span>` : ''}</th><td>${cell}</td></tr>`
    }
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
// Fetches a signed URL (private bucket — same access rules as every other
// request submission file) for each signature-type field that has an
// attached image, before the HTML is built — templates themselves stay
// synchronous string-builders.
async function fetchSignatureUrls(form, submission) {
  const sigFields = (form.request_form_fields || []).filter(f => f.field_type === 'signature')
  if (!sigFields.length) return {}
  const { data: files } = await supabase.from('request_submission_files')
    .select('field_id, file_path')
    .eq('submission_id', submission.id)
    .in('field_id', sigFields.map(f => f.id))
  if (!files?.length) return {}
  const entries = await Promise.all(files.map(async f => {
    const { data } = await supabase.storage.from('request-attachments').createSignedUrl(f.file_path, 3600)
    return [f.field_id, data?.signedUrl]
  }))
  return Object.fromEntries(entries.filter(([, url]) => url))
}

export async function buildPrintHtml(form, submission) {
  const signatureUrls = await fetchSignatureUrls(form, submission)
  if (form.print_template === 'custom' && CUSTOM_TEMPLATES[form.custom_template_key]) {
    return CUSTOM_TEMPLATES[form.custom_template_key](form, submission)
  }
  return buildDefaultTemplate(form, submission, signatureUrls)
}

function openPrintWindow(html) {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  w.onload = () => { w.focus(); w.print() }
}

// Print always goes through the browser's native print dialog — this is
// the ONLY function that ever triggers it.
export async function printSubmission(form, submission) {
  openPrintWindow(await buildPrintHtml(form, submission))
}

// ── Shared PDF generation (single source for Preview + Download) ───────
// Both the in-app preview and the direct download render this exact same
// generated PDF file — there is no separate "preview version" and
// "download version" of the report. The underlying HTML is the identical
// buildPrintHtml() output the Print flow also uses, so all three actions
// (Preview / Print / Download) always show the same content; only how
// each one is presented differs (rasterized+paginated into a real PDF
// file here, vs. rendered live in a print-dialog window for Print).
async function renderHtmlToPdf(html) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  // Render the report HTML off-screen at a fixed A4-proportioned width so
  // html2canvas captures it exactly as it would print, then tear the
  // container down again regardless of success or failure.
  const container = document.createElement('div')
  container.style.position = 'fixed'
  container.style.top = '-10000px'
  container.style.left = '0'
  container.style.width = '794px' // ~210mm at 96dpi
  container.style.background = '#fff'
  const iframe = document.createElement('iframe')
  iframe.style.width = '794px'
  iframe.style.border = 'none'
  container.appendChild(iframe)
  document.body.appendChild(container)

  try {
    iframe.srcdoc = html
    await new Promise((resolve) => { iframe.onload = resolve })
    const doc = iframe.contentDocument
    const bodyHeight = doc.body.scrollHeight
    iframe.style.height = `${bodyHeight}px`
    // Let images (QPC logo, embedded document thumbnails, signatures)
    // finish loading before measuring anything below — an unloaded image
    // has zero height and would throw off every block's bounding rect.
    const images = Array.from(doc.images || [])
    await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res })))

    const scale = 2
    const canvas = await html2canvas(doc.body, { scale, useCORS: true, backgroundColor: '#ffffff' })
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()

    // CSS-pixel height of one PDF page, once the report is scaled to fill
    // the page width — this is the "budget" pagination works against, in
    // the same coordinate space as the DOM measurements below.
    const cssPageHeight = pageHeight * (doc.body.clientWidth / pageWidth)

    // Every element that must never be cut across a page boundary — table
    // rows (each one is a full label+value pair, including signature
    // images), signature blocks, and section headers glued to whatever
    // follows them. Sorted top-to-bottom; overlapping/nested unbreakable
    // elements (e.g. an <img> inside a <tr>) are naturally subsumed since
    // we only need the outermost boundary that must not be split.
    const unbreakable = Array.from(doc.querySelectorAll('tr, .sig-row, .qpc-header, .meta-row'))
      .map(el => {
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom }
      })
      .filter(b => b.bottom > b.top)
      .sort((a, b) => a.top - b.top)

    // Walk the document top to bottom, one page-height "budget" at a
    // time. If the tentative page end would land strictly inside an
    // unbreakable block, pull the break back to that block's top edge
    // instead — the whole block moves to the next page rather than being
    // sliced through the middle. A single block taller than one full
    // page (pathological case) is left to overflow onto its own page
    // rather than looping forever.
    const breakpoints = [0]
    let cursor = 0
    while (cursor < bodyHeight - 0.5) {
      let tentativeEnd = Math.min(cursor + cssPageHeight, bodyHeight)
      const straddling = unbreakable.filter(b => b.top < tentativeEnd - 0.5 && b.bottom > tentativeEnd + 0.5)
      if (straddling.length) {
        const earliestTop = Math.min(...straddling.map(b => b.top))
        if (earliestTop > cursor + 1) tentativeEnd = earliestTop
        // else: this single block is taller than a page — let it overflow.
      }
      breakpoints.push(tentativeEnd)
      cursor = tentativeEnd
    }

    // Slice the one full-page-width canvas into a separate cropped canvas
    // per page (never a raw pixel-offset draw of the SAME tall image),
    // so each PDF page only ever contains whole, unsplit content.
    const imgWidth = pageWidth
    for (let p = 0; p < breakpoints.length - 1; p++) {
      const sliceTopCss = breakpoints[p]
      const sliceBottomCss = breakpoints[p + 1]
      const sliceHeightPx = Math.max(1, Math.round((sliceBottomCss - sliceTopCss) * scale))
      const sliceCanvas = document.createElement('canvas')
      sliceCanvas.width = canvas.width
      sliceCanvas.height = sliceHeightPx
      const ctx = sliceCanvas.getContext('2d')
      ctx.drawImage(canvas, 0, Math.round(sliceTopCss * scale), canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx)
      const sliceImgHeightPt = (sliceHeightPx / canvas.width) * imgWidth

      if (p > 0) pdf.addPage()
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, sliceImgHeightPt)
    }
    return pdf
  } finally {
    document.body.removeChild(container)
  }
}

function submissionPdfFilename(submission) {
  const ref = submission.reference_number || submission.id
  return `Submission_${ref}.pdf`
}

// Downloads the generated PDF directly — no browser print dialog, no new
// tab/window, no navigation away from the submission the admin is on.
export async function downloadSubmissionPdf(form, submission) {
  const pdf = await renderHtmlToPdf(await buildPrintHtml(form, submission))
  pdf.save(submissionPdfFilename(submission))
}

// Generates the same PDF and returns it as an object URL for an in-app
// preview (e.g. an <iframe>/PdfPreviewModal-style viewer), plus the blob
// itself so the preview's own Download button can save the identical file
// without regenerating it a second time.
export async function previewSubmissionPdf(form, submission) {
  const pdf = await renderHtmlToPdf(await buildPrintHtml(form, submission))
  const blob = pdf.output('blob')
  return { url: URL.createObjectURL(blob), blob, filename: submissionPdfFilename(submission) }
}
