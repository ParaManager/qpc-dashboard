import { qpcLogo } from './logos'
import { supabase } from './supabase'
// Static imports, not dynamic import() at call time — jsPDF is already
// statically imported elsewhere (Athletes.jsx, SpecialOlympics.jsx), so a
// dynamic import here just duplicated it into a second lazy chunk for no
// benefit (Rollup already flagged this as an ineffective dynamic import).
// html2canvas is only used here, but PDF Preview/Download is a core,
// frequently-used feature, and a dynamic import means every click fetches
// a separately-hashed chunk at runtime — if a new Vercel deployment has
// since replaced that chunk's hash, an already-open tab still running the
// previous JS bundle asks for a file that no longer exists on the server
// and the import() rejects with "Failed to fetch dynamically imported
// module". Bundling both statically means everything PDF generation
// needs is already loaded with the rest of the app; there is no
// separate lazy fetch left to go stale.
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

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
  /* Same compact branding lockup used across every other QPC PDF export
     (Events, Athletes list): logo on the left, org name beside it with a
     muted subtitle directly underneath, maroon divider below — instead
     of a generic blue-bordered header that didn't match the logo's
     actual color identity. */
  .qpc-header { display:flex; align-items:center; gap:14px; padding-bottom:14px; margin-bottom:16px; border-bottom:3px solid #571932; break-inside:avoid; page-break-inside:avoid; }
  .qpc-header img { height:52px; width:auto; }
  .qpc-header .titles { flex:1; }
  .qpc-header .titles .org-en { font-size:15px; font-weight:700; color:#1a1a1a; }
  .qpc-header .titles .org-sub { font-size:9.5px; color:#888; margin-top:2px; }
  .form-title { margin-bottom:14px; }
  .form-title .en { font-size:17px; font-weight:700; color:#571932; }
  .form-title .ar { font-size:14px; font-weight:700; direction:rtl; color:#444; margin-top:2px; }
  .meta-row { display:flex; justify-content:space-between; font-size:11.5px; color:#555; margin-bottom:14px; break-inside:avoid; page-break-inside:avoid; }
  .status-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700; background:#57193214; color:#571932; }
  table { width:100%; border-collapse:collapse; margin-bottom:14px; }
  thead { display: table-header-group; } /* repeat header row on each printed page where the browser supports it */
  tr { break-inside:avoid; page-break-inside:avoid; }
  tr:nth-child(even) td, tr:nth-child(even) th { background:#fdf5f6; }
  th, td { border:1px solid #e2d9db; padding:7px 9px; font-size:12px; text-align:left; vertical-align:top; }
  th { background:#f7eef0; width:38%; font-weight:600; color:#333; }
  .section-title { font-size:13px; font-weight:700; color:#571932; text-transform:uppercase; letter-spacing:.04em; margin:20px 0 7px; border-bottom:1.5px solid #571932; padding-bottom:4px; break-after:avoid; page-break-after:avoid; }
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

  function fieldRow(f) {
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
  }

  // Content blocks (section_title/description/divider) never collect an
  // answer, so they're never a table row — they break the field list into
  // separate <table> chunks with the block rendered as its own element in
  // between, preserving the exact original order. This is also what lets
  // the .section-title CSS rules (break-after:avoid, glued to the table
  // that follows it) actually apply — a real sibling relationship, not a
  // row inside one continuous table.
  let fieldsHtml = ''
  let pendingRows = []
  function flushTable() {
    if (pendingRows.length) {
      fieldsHtml += `<table>${pendingRows.join('')}</table>`
      pendingRows = []
    }
  }
  for (const f of fields) {
    if (f.field_type === 'divider') {
      flushTable()
      fieldsHtml += `<hr style="border:none;border-top:1px solid #ccc;margin:18px 0;" />`
    } else if (f.field_type === 'section_title') {
      flushTable()
      fieldsHtml += `<div class="section-title">${esc(f.label)}${f.label_ar ? `<br/><span dir="rtl" style="font-weight:400;color:#777;text-transform:none;letter-spacing:normal;">${esc(f.label_ar)}</span>` : ''}</div>`
    } else if (f.field_type === 'description') {
      flushTable()
      fieldsHtml += `<div style="font-size:12px;color:#555;line-height:1.6;margin-bottom:12px;white-space:pre-wrap;">${esc(f.label)}${f.label_ar ? `<br/><span dir="rtl">${esc(f.label_ar)}</span>` : ''}</div>`
    } else {
      pendingRows.push(fieldRow(f))
    }
  }
  flushTable()

  const body = `
    <div class="qpc-header">
      <img src="${qpcLogo}" />
      <div class="titles">
        <div class="org-en">Qatar Paralympic Committee</div>
        <div class="org-sub">Submission Report</div>
      </div>
    </div>
    <div class="form-title">
      <div class="en">${esc(form.title)}</div>
      ${form.title_ar ? `<div class="ar">${esc(form.title_ar)}</div>` : ''}
    </div>
    <div class="meta-row">
      <span>Reference: <b>${esc(submission.reference_number || submission.id)}</b></span>
      <span>Submitted: <b>${esc(new Date(submission.submitted_at).toLocaleString())}</b></span>
      <span>Status: <span class="status-badge">${esc(STATUS_LABEL[submission.status] || submission.status)}</span></span>
    </div>
    <div class="meta-row"><span>Submitted by: <b>${esc(submittedBy)}</b></span></div>
    ${fieldsHtml}
  `
  return printShell(body, form.title)
}

// ── Public entry point ──────────────────────────────────────────────────
// Every form uses this one shared, professionally-branded template —
// Registration Form and every other form render identically in structure
// (only their own fields/sections differ), so there's no separate custom
// template to keep in sync with the shared one.
// Fetches a signed URL (private bucket — same access rules as every other
// request submission file) for each signature-type field that has an
// attached image, before the HTML is built — the template itself stays a
// synchronous string-builder.
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

    // Consistent top/bottom margins on every page (including page 1) —
    // content only ever renders inside this usable band, never flush
    // against the page edge.
    const MM_TO_PT = 2.834645669
    const marginTopPt = 11 * MM_TO_PT
    const marginBottomPt = 10 * MM_TO_PT
    const usablePageHeight = pageHeight - marginTopPt - marginBottomPt

    // CSS-pixel height of one page's USABLE area (after margins), once
    // the report is scaled to fill the page width — this is the actual
    // "budget" pagination works against, in the same coordinate space as
    // the DOM measurements below. Using the full page height here (as
    // before) would let a page's content run into the bottom margin;
    // shrinking the budget to the margin-adjusted height is what keeps
    // every page's content inside the intended band.
    const cssPageHeight = usablePageHeight * (doc.body.clientWidth / pageWidth)

    // Every element that must never be cut across a page boundary — table
    // rows (each one is a full label+value pair, including signature
    // images), signature blocks, and section headers glued to whatever
    // follows them. Sorted top-to-bottom; overlapping/nested unbreakable
    // elements (e.g. an <img> inside a <tr>) are naturally subsumed since
    // we only need the outermost boundary that must not be split.
    const unbreakable = Array.from(doc.querySelectorAll('tr, .sig-row, .qpc-header, .meta-row, .form-title'))
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
    // so each PDF page only ever contains whole, unsplit content. Every
    // page's image is placed starting at marginTopPt — page 1 included —
    // so there's always the same comfortable white space above the
    // content, not just on later pages.
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
      pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', 0, marginTopPt, imgWidth, sliceImgHeightPt)
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
