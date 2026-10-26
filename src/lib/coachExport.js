import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { sportLabel, effectiveStatus, SPORT_CATEGORY_NAMES_AR, loadImageAsDataURL, safeAddImage, getCurrentSeason } from './helpers'

// Coaches list export (Excel + PDF). Rows are exactly the coaches the
// Coaches page is currently showing (search/filters/sort already applied by
// the caller). Assigned athletes come from the caller's athletesForCoach(),
// i.e. the same union of athletes.coach_id and athlete_sports rows the page
// itself displays.

const STATUS_AR = { 'Active':'نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Inactive':'غير نشط','Suspended':'موقوف','External':'خارجي','When needed':'عند الحاجة' }
const GENDER_AR = { Male: 'ذكر', Female: 'أنثى' }
const s = v => (v === null || v === undefined || v === 'null' || v === 'undefined') ? '' : String(v)

function buildColumns(ar) {
  const L = (en, a) => ar ? a : en
  return [
    { key: 'idx',        label: '#',                          w: 20,  get: (c, i) => i + 1 },
    { key: 'name',       label: L('English Name', 'الاسم بالإنجليزية'), w: 100, get: c => s(c.name) },
    { key: 'name_ar',    label: L('Arabic Name', 'الاسم بالعربية'),     w: 90, arabic: true, get: c => s(c.name_ar) },
    { key: 'designation',label: L('Designation', 'المسمى الوظيفي'),     w: 65,  get: (c, i, x) => ar ? (s(c.designation_ar) || s(c.designation)) : s(c.designation) },
    { key: 'gender',     label: L('Gender', 'الجنس'),                   w: 36,  get: c => ar ? (GENDER_AR[c.gender] || s(c.gender)) : s(c.gender) },
    { key: 'nationality',label: L('Nationality', 'الجنسية'),            w: 55,  get: (c, i, x) => x.tc(s(c.nationality)) },
    { key: 'sport',      label: L('Sport', 'الرياضة'),                  w: 75,  get: c => c.sport ? s(sportLabel(c.sport, c.sport_category, ar)) : '' },
    { key: 'category',   label: L('Sport Category', 'فئة الرياضة'),     w: 65,  get: c => ar ? (SPORT_CATEGORY_NAMES_AR[c.sport_category] || s(c.sport_category)) : s(c.sport_category) },
    { key: 'status',     label: L('Status', 'الحالة'),                  w: 50,  get: c => { const st = effectiveStatus(c); return ar ? (STATUS_AR[st] || s(st)) : s(st) } },
    { key: 'count',      label: L('Athletes', 'عدد الرياضيين'),         w: 36,  get: (c, i, x) => x.athletesFor(c.id).length },
    { key: 'athletes',   label: L('Assigned Athletes', 'الرياضيون المعينون'), w: 0, get: (c, i, x) => x.athletesFor(c.id).map(a => (ar && a.name_ar) ? a.name_ar : a.name).filter(Boolean).join(ar ? '، ' : ', ') },
  ]
}

function rowsFor(coaches, ctx) {
  const cols = buildColumns(ctx.lang === 'ar')
  return { cols, rows: coaches.map((c, i) => cols.map(col => col.get(c, i, ctx))) }
}

export function exportCoachesExcel(coaches, ctx) {
  const ar = ctx.lang === 'ar'
  const { cols, rows } = rowsFor(coaches, ctx)
  const ordered = ar ? [...cols].reverse() : cols
  const idxs = ordered.map(c => cols.indexOf(c))
  const aoa = [ordered.map(c => c.label), ...rows.map(r => idxs.map(i => r[i]))]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  ws['!cols'] = ordered.map(c => ({ wch: c.key === 'idx' ? 5 : c.key === 'athletes' ? 60 : c.key === 'count' ? 10 : 22 }))
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }
  const wb = XLSX.utils.book_new()
  if (ar) wb.Workbook = { Views: [{ RTL: true }] }
  XLSX.utils.book_append_sheet(wb, ws, ar ? 'المدربون' : 'Coaches')
  XLSX.writeFile(wb, `QPC_${ar ? 'المدربون' : 'Coaches'}_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export async function exportCoachesPdf(coaches, ctx) {
  const ar = ctx.lang === 'ar'
  const L = (en, a) => ar ? a : en
  const { cols, rows } = rowsFor(coaches, ctx)
  const ordered = ar ? [...cols].reverse() : cols
  const idxs = ordered.map(c => cols.indexOf(c))

  const logo = await loadImageAsDataURL('/logo-qpc.png')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()

  // Amiri covers Arabic glyphs (Helvetica has none). Needed for the whole
  // doc in Arabic mode, and for the Arabic Name column in English mode.
  let arabicOk = false
  try {
    const { AMIRI_REGULAR_BASE64 } = await import('./fonts/AmiriFont')
    doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_REGULAR_BASE64)
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
    doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold')
    arabicOk = true
  } catch (e) { console.error('Coaches PDF: Arabic font failed to load', e) }
  const FONT = (ar && arabicOk) ? 'Amiri' : 'helvetica'
  const MAROON = [87, 25, 50]

  let logoW = 0, logoH = 0
  if (logo) {
    try {
      const p = doc.getImageProperties(logo)
      const r = Math.min(100 / p.width, 42 / p.height)
      logoW = p.width * r; logoH = p.height * r
    } catch { /* draw without logo */ }
  }
  const drawHeader = () => {
    const y = 14
    safeAddImage(doc, logo, ar ? pageW - 36 - logoW : 36, y, logoW, logoH)
    doc.setFont(FONT, 'bold'); doc.setFontSize(12.5); doc.setTextColor(20, 20, 20)
    doc.text(L('Qatar Paralympic Committee', 'اللجنة البارالمبية القطرية'), pageW / 2, y + 12, { align: 'center' })
    doc.setFont(FONT, 'normal'); doc.setFontSize(9.5)
    doc.text(ar ? 'قائمة المدربين' : `Coaches List (${coaches.length})`, pageW / 2, y + 25, { align: 'center' })
    doc.setFontSize(8); doc.setTextColor(110, 110, 110)
    doc.text(`${L('Season', 'الموسم')} ${getCurrentSeason()}`, pageW / 2, y + 36, { align: 'center' })
    doc.text(`${L('Export date', 'تاريخ التصدير')}: ${new Date().toISOString().slice(0, 10)}`, ar ? 36 : pageW - 36, y + 10, { align: ar ? 'left' : 'right' })
    if (ctx.filterSummary) doc.text(ctx.filterSummary, ar ? 36 : pageW - 36, y + 22, { align: ar ? 'left' : 'right', maxWidth: 260 })
    doc.setDrawColor(...MAROON); doc.setLineWidth(1.1); doc.line(36, y + 44, pageW - 36, y + 44)
  }

  const arabicColIdx = new Set(ordered.map((c, i) => c.arabic ? i : -1).filter(i => i >= 0))
  const colStyles = Object.fromEntries(ordered.map((c, i) => [i, c.w ? { cellWidth: c.w } : {}]))

  autoTable(doc, {
    head: [ordered.map(c => c.label)],
    body: rows.map(r => idxs.map(i => String(r[i] ?? ''))),
    startY: 76,
    margin: { top: 76, left: 36, right: 36, bottom: 26 },
    styles: { font: FONT, fontSize: 7.5, cellPadding: 3.5, valign: 'middle', overflow: 'linebreak', halign: ar ? 'right' : 'left', lineColor: [232, 220, 224], lineWidth: 0.4 },
    headStyles: { font: FONT, fillColor: MAROON, textColor: 255, fontStyle: 'bold', halign: ar ? 'right' : 'left' },
    alternateRowStyles: { fillColor: [249, 244, 245] },
    columnStyles: colStyles,
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    didParseCell: d => {
      if (arabicOk && arabicColIdx.has(d.column.index)) { d.cell.styles.font = 'Amiri'; d.cell.styles.halign = 'right' }
    },
    didDrawPage: () => {
      drawHeader()
      doc.setFont(FONT, 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120)
      doc.text(`${doc.internal.getCurrentPageInfo().pageNumber}`, pageW / 2, doc.internal.pageSize.getHeight() - 12, { align: 'center' })
    },
  })
  doc.save(`QPC_${ar ? 'المدربون' : 'Coaches'}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
