import { useState, useMemo, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { useLang, translateCountry } from '../lib/LangContext.jsx'
import { isAdminRole, canViewAthleteDetails } from '../lib/permissions'
import {
  ProfileAvatar, DashRow, Badge, statusClass, buildSearchText, matchesSearch,
  effectiveStatus, getCurrentSeason, loadImageAsDataURL, safeAddImage,
} from '../lib/helpers'
import { toast } from '../components/Toast'

// Membership rule — same convention already used elsewhere in the app
// (Events.jsx's athleteMatchesSports) for identifying Special Olympics
// participants: the legacy flat 'Special Olympics' sport tag, or either of
// the two Special Olympics sport_category values. No separate/duplicate
// data source — this reads the exact same fields the rest of the app
// already uses for sport/category membership.
function isSpecialOlympics(person) {
  if (!person) return false
  return person.sport === 'Special Olympics'
    || person.sport_category === 'Summer Special Olympics'
    || person.sport_category === 'Winter Special Olympics'
}

// Selectable PDF columns for the athlete table — checked in the export
// modal. 'photo' is handled as a pseudo-column (paired next to the name
// columns, like the Athletes page PDF) rather than a plain data field.
const SO_ATHLETE_COLS = [
  { key: 'photo',           labelEn: 'Photo',          labelAr: 'الصورة',           default: true, isPhoto: true },
  { key: 'name',            labelEn: 'English Name',   labelAr: 'الاسم بالانجليزي', default: true },
  { key: 'name_ar',         labelEn: 'Arabic Name',    labelAr: 'الاسم بالعربي',    default: false },
  { key: 'nationality',     labelEn: 'Nationality',    labelAr: 'الجنسية',          default: true },
  { key: 'classification',  labelEn: 'Classification', labelAr: 'التصنيف',          default: true },
  { key: 'gender',          labelEn: 'Gender',         labelAr: 'الجنس',            default: false },
  { key: 'dob',             labelEn: 'Date of Birth',  labelAr: 'تاريخ الميلاد',    default: false },
  { key: 'age',             labelEn: 'Age',            labelAr: 'العمر',            default: false },
  { key: 'status',          labelEn: 'Status',         labelAr: 'الحالة',           default: true },
  { key: 'medical_status',  labelEn: 'Medical Status', labelAr: 'الحالة الطبية',    default: false },
  { key: 'qss_number',      labelEn: 'QSS #',          labelAr: 'رقم QSS',          default: false },
]

export default function SpecialOlympics({ athletes = [], coaches = [], onNav, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const [search, setSearch] = useState('')
  const [pdfExporting, setPdfExporting] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [exportLang, setExportLang] = useState(lang)
  const [exportCols, setExportCols] = useState(() => SO_ATHLETE_COLS.filter(c => c.default).map(c => c.key))
  const modalRef = useRef(null)

  // Same read-only-vs-clickable permission rules already used on the
  // Sports page for its member rosters — no new access is granted here.
  const canClickAthletes = canViewAthleteDetails(profile)
  const canClickCoaches = isAdminRole(profile)

  const soAthletes = useMemo(() => athletes.filter(isSpecialOlympics), [athletes])
  const soCoaches = useMemo(() => coaches.filter(isSpecialOlympics), [coaches])

  const filteredAthletes = useMemo(() => {
    if (!search) return soAthletes
    return soAthletes.filter(a => matchesSearch(buildSearchText(a.name, a.name_ar, a.nationality, a.classification), search))
  }, [soAthletes, search])
  const filteredCoaches = useMemo(() => {
    if (!search) return soCoaches
    return soCoaches.filter(c => matchesSearch(buildSearchText(c.name, c.name_ar, c.nationality), search))
  }, [soCoaches, search])

  useEffect(() => {
    if (!exportModalOpen) return
    function onEscape(e) { if (e.key === 'Escape') setExportModalOpen(false) }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [exportModalOpen])

  function openExportModal() {
    setExportLang(lang) // default to the page's current language each time it's opened
    setExportModalOpen(true)
  }

  function toggleCol(key) {
    setExportCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }

  async function handleConfirmExport() {
    setPdfExporting(true)
    setExportModalOpen(false)
    try {
      // Live data at export time — re-reads the same soAthletes/soCoaches
      // the page is currently showing, never a cached/earlier snapshot.
      await exportSpecialOlympicsPDF(soAthletes, soCoaches, exportLang, exportCols)
    } catch (err) {
      console.error('Special Olympics PDF export failed', err)
      toast(ar ? 'تعذر إنشاء ملف PDF' : 'Could not generate the PDF')
    } finally {
      setPdfExporting(false)
    }
  }

  return (
    <div>
      <div style={{
        display:'flex', alignItems:'center', gap:18, flexWrap:'wrap',
        background:'linear-gradient(135deg,#0085C7,#00A5E0)', borderRadius:16,
        padding:'22px 26px', marginBottom:20, color:'#fff',
      }}>
        <div style={{ width:64, height:64, borderRadius:12, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, padding:6 }}>
          <img src="/logo-so.png" alt="Special Olympics" style={{ maxWidth:'100%', maxHeight:'100%', objectFit:'contain' }} />
        </div>
        <div style={{ flex:1, minWidth:180 }}>
          <div style={{ fontSize:22, fontWeight:700 }}>{ar ? 'الأولمبياد الخاص' : 'Special Olympics'}</div>
          <div style={{ fontSize:13, opacity:.85 }}>{ar ? 'الموسم' : 'Season'} {getCurrentSeason()}</div>
        </div>
        <button
          type="button"
          onClick={openExportModal}
          disabled={pdfExporting}
          style={{ display:'flex', alignItems:'center', gap:6, background:'#fff', color:'#c0392b', border:'none', borderRadius:9, padding:'9px 16px', fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
          <i className="ti ti-file-type-pdf" /> {pdfExporting ? tx('actions.exporting','Exporting...') : tx('actions.exportPdf','Export PDF')}
        </button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginBottom:20 }}>
        <div className="info-card" style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:'#0085C715', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-run" style={{ fontSize:20, color:'#0085C7' }} />
          </div>
          <div>
            <div style={{ fontSize:24, fontWeight:700 }}>{soAthletes.length}</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>{ar ? 'إجمالي الرياضيين' : 'Total Athletes'}</div>
          </div>
        </div>
        <div className="info-card" style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:'#009F6B15', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="ti ti-user-star" style={{ fontSize:20, color:'#009F6B' }} />
          </div>
          <div>
            <div style={{ fontSize:24, fontWeight:700 }}>{soCoaches.length}</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>{ar ? 'إجمالي المدربين' : 'Total Coaches'}</div>
          </div>
        </div>
      </div>

      <div className="search-wrap" style={{ marginBottom:18 }}>
        <i className="ti ti-search" />
        <input
          placeholder={ar ? 'بحث بالاسم أو الجنسية…' : 'Search by name or nationality…'}
          value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="info-card" style={{ marginBottom:20 }}>
        <div className="info-title">
          {ar ? 'المدربون' : 'Coaches'} ({filteredCoaches.length})
          {canClickCoaches && <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}> — {tx('athletes.clickToView','click to view')}</span>}
        </div>
        {filteredCoaches.length === 0
          ? <div className="empty">{ar ? 'لا يوجد مدربون' : 'No coaches'}</div>
          : filteredCoaches.map(c => (
              <DashRow key={c.id} clickable={canClickCoaches} onClick={() => onNav('coaches', { coachId: c.id })}>
                <ProfileAvatar photoUrl={c.photo_url} name={c.name} id={c.id} size={34} fs={11} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{ar && c.name_ar ? c.name_ar : c.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{translateCountry(c.nationality, lang)}</div>
                </div>
                <Badge label={effectiveStatus(c)} cls={statusClass(effectiveStatus(c))} />
              </DashRow>
            ))
        }
      </div>

      <div className="info-card">
        <div className="info-title">
          {ar ? 'الرياضيون' : 'Athletes'} ({filteredAthletes.length})
          {canClickAthletes && <span style={{ fontSize:10, fontWeight:400, textTransform:'none', letterSpacing:0 }}> — {tx('athletes.clickToView','click to view')}</span>}
        </div>
        {filteredAthletes.length === 0
          ? <div className="empty">{ar ? 'لا يوجد رياضيون' : 'No athletes'}</div>
          : filteredAthletes.map(a => (
              <DashRow key={a.id} clickable={canClickAthletes} onClick={() => onNav('athletes', { athleteId: a.id })}>
                <ProfileAvatar photoUrl={a.photo_url} name={a.name} id={a.id} size={34} fs={11} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{ar && a.name_ar ? a.name_ar : a.name}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{translateCountry(a.nationality, lang)}</div>
                </div>
                <Badge label={effectiveStatus(a)} cls={statusClass(effectiveStatus(a))} />
              </DashRow>
            ))
        }
      </div>

      {exportModalOpen && (
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setExportModalOpen(false) }}
          style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(10,10,14,.5)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div ref={modalRef} onMouseDown={e => e.stopPropagation()}
            style={{ width:'100%', maxWidth:420, maxHeight:'86vh', background:'var(--surface)', borderRadius:14, boxShadow:'0 20px 60px rgba(0,0,0,.35)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontSize:15, fontWeight:700 }}>{ar ? 'تصدير PDF — الأولمبياد الخاص' : 'Export PDF — Special Olympics'}</div>
              <button type="button" onClick={() => setExportModalOpen(false)} style={{ width:28, height:28, borderRadius:8, border:'none', background:'var(--surface2)', color:'var(--text2)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-x" />
              </button>
            </div>

            <div style={{ padding:'16px 18px', overflowY:'auto', flex:1 }}>
              <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.4, marginBottom:8 }}>
                {ar ? 'الخطوة 1 — اللغة' : 'Step 1 — Language'}
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:20 }}>
                {[{ v:'en', l:'English' }, { v:'ar', l:'العربية' }].map(opt => (
                  <button key={opt.v} type="button" onClick={() => setExportLang(opt.v)}
                    style={{
                      flex:1, padding:'9px 10px', borderRadius:9, cursor:'pointer', fontSize:13, fontWeight:600,
                      border: exportLang === opt.v ? '2px solid #c0392b' : '1px solid var(--border)',
                      background: exportLang === opt.v ? '#c0392b12' : 'var(--surface)',
                      color: exportLang === opt.v ? '#c0392b' : 'var(--text)',
                    }}>
                    {opt.l}
                  </button>
                ))}
              </div>

              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                <div style={{ fontSize:11.5, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.4 }}>
                  {ar ? 'الخطوة 2 — الأعمدة' : 'Step 2 — Columns'}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button type="button" onClick={() => setExportCols(SO_ATHLETE_COLS.map(c => c.key))} style={{ fontSize:11, color:'#0085C7', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                    {ar ? 'تحديد الكل' : 'Select All'}
                  </button>
                  <button type="button" onClick={() => setExportCols([])} style={{ fontSize:11, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>
                    {ar ? 'مسح الكل' : 'Clear All'}
                  </button>
                </div>
              </div>
              <div style={{ border:'1px solid var(--border)', borderRadius:9, overflow:'hidden' }}>
                {SO_ATHLETE_COLS.map(c => (
                  <label key={c.key} style={{ display:'flex', alignItems:'center', gap:9, padding:'8px 12px', fontSize:13, borderBottom:'1px solid var(--border)', cursor:'pointer' }}>
                    <input type="checkbox" checked={exportCols.includes(c.key)} onChange={() => toggleCol(c.key)} />
                    <span>{ar ? c.labelAr : c.labelEn}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>
                {ar ? 'معلومات المدرب تُدرج دائمًا بشكل منفصل بغض النظر عن اختيارك.' : 'Coach information is always included separately, regardless of your selection.'}
              </div>
            </div>

            <div style={{ padding:'14px 18px', borderTop:'1px solid var(--border)' }}>
              <button
                type="button"
                onClick={handleConfirmExport}
                disabled={exportCols.length === 0 || pdfExporting}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:7,
                  background: exportCols.length === 0 ? 'var(--surface2)' : '#c0392b', color: exportCols.length === 0 ? 'var(--text3)' : '#fff',
                  border:'none', borderRadius:9, padding:'11px 16px', fontSize:14, fontWeight:700,
                  cursor: exportCols.length === 0 ? 'not-allowed' : 'pointer',
                }}>
                <i className="ti ti-file-type-pdf" /> {ar ? 'تصدير PDF' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PDF export — reuses the shared jsPDF image helpers (loadImageAsDataURL/
// safeAddImage from helpers.jsx, the same ones the Athletes list export
// uses) and the same Amiri-font approach for Arabic, rather than
// duplicating that logic. Always builds from whatever athlete/coach arrays
// are passed in at call time — i.e. live data, not a cached snapshot.
// `exportLang`/`selectedColKeys` come from the export modal, independent of
// the page's own current display language/state.
async function exportSpecialOlympicsPDF(soAthletes, soCoaches, exportLang, selectedColKeys) {
  const ar = exportLang === 'ar'
  const L = (en, a) => ar ? a : en
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Injured':'مصاب','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}
  const statusLabel = s => ar ? (STATUS_AR[s] || s || '') : (s || '')
  const safeStr = v => (v === null || v === undefined) ? '' : String(v)

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  // Amiri font — loaded whenever the export is Arabic, or an Arabic-only
  // field (Arabic Name) is selected in an otherwise-English export, so
  // that cell never falls back to Helvetica's missing Arabic glyphs.
  const needsArabicFont = ar || selectedColKeys.includes('name_ar')
  let arabicFontOk = false
  if (needsArabicFont) {
    try {
      const { AMIRI_REGULAR_BASE64 } = await import('../lib/fonts/AmiriFont')
      doc.addFileToVFS('Amiri-Regular.ttf', AMIRI_REGULAR_BASE64)
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal')
      doc.addFont('Amiri-Regular.ttf', 'Amiri', 'bold')
      arabicFontOk = true
    } catch (err) {
      console.error('PDF export: Arabic font failed to load, falling back to Helvetica', err)
    }
  }
  const FONT = (ar && arabicFontOk) ? 'Amiri' : 'helvetica'
  const setPdfFont = (style) => doc.setFont(FONT, style)
  const pageWidth = doc.internal.pageSize.getWidth()

  // Special Olympics red — the one accent/header color used throughout,
  // replacing the QPC blue used elsewhere in the app's other PDF exports.
  const SO_RED = [211, 47, 47]

  const [soLogo, athletePhotos, coachPhotos] = await Promise.all([
    loadImageAsDataURL('/logo-so.png'),
    Promise.all(soAthletes.map(a => loadImageAsDataURL(a?.photo_url))),
    Promise.all(soCoaches.map(c => loadImageAsDataURL(c?.photo_url))),
  ])

  let logoW = 0, logoH = 0
  if (soLogo) {
    try {
      const props = doc.getImageProperties(soLogo)
      const ratio = Math.min(120 / props.width, 52 / props.height)
      logoW = props.width * ratio
      logoH = props.height * ratio
    } catch { /* logo just won't be drawn */ }
  }

  function drawHeader() {
    const topY = 16
    safeAddImage(doc, soLogo, 36, topY, logoW, logoH) // no QPC logo in this report — Special Olympics logo only
    setPdfFont('bold')
    doc.setFontSize(14)
    doc.setTextColor(20, 20, 20)
    doc.text(safeStr(L('Special Olympics Report', 'تقرير الأولمبياد الخاص')), pageWidth / 2, topY + 14, { align: 'center' })
    setPdfFont('normal')
    doc.setFontSize(9.5)
    doc.setTextColor(110, 110, 110)
    const exportDate = new Date().toISOString().slice(0, 10)
    doc.text(safeStr(`${L('Season', 'الموسم')} ${getCurrentSeason()}  •  ${L('Export date', 'تاريخ التصدير')}: ${exportDate}`), pageWidth / 2, topY + 30, { align: 'center' })
    setPdfFont('bold')
    doc.setFontSize(9.5)
    doc.setTextColor(SO_RED[0], SO_RED[1], SO_RED[2])
    const totals = `${L('Total Athletes', 'إجمالي الرياضيين')}: ${soAthletes.length}    ${L('Total Coaches', 'إجمالي المدربين')}: ${soCoaches.length}`
    doc.text(safeStr(totals), pageWidth - 36, topY + 14, { align: 'right' })
    doc.setDrawColor(SO_RED[0], SO_RED[1], SO_RED[2])
    doc.setLineWidth(1.4)
    doc.line(36, topY + 44, pageWidth - 36, topY + 44)
  }

  const HEADER_H = 74
  const PHOTO_IMG_SIZE = 18

  // Dynamic per-column minimum widths, sized from the header text at the
  // current font — same technique used by the Athletes list PDF export, so
  // short headers never wrap and wide data columns (Name) absorb whatever
  // space is left.
  function drawTable(startY, titleEn, titleAr, photoColIndex, headLabels, bodyRows, photoUrls, accentTint) {
    setPdfFont('bold')
    doc.setFontSize(11.5)
    doc.setTextColor(SO_RED[0], SO_RED[1], SO_RED[2])
    doc.text(safeStr(L(titleEn, titleAr)), ar ? pageWidth - 36 : 36, startY, { align: ar ? 'right' : 'left' })

    const availableTableWidth = pageWidth - 36 - 36
    let headerFontSize = 8
    let colMinWidths = {}
    for (let attempt = 0; attempt < 6; attempt++) {
      setPdfFont('bold')
      doc.setFontSize(headerFontSize)
      colMinWidths = {}
      headLabels.forEach((label, i) => {
        colMinWidths[i] = i === photoColIndex ? (PHOTO_IMG_SIZE + 8) : Math.ceil(doc.getTextWidth(safeStr(label))) + 10
      })
      const total = Object.values(colMinWidths).reduce((sum, w) => sum + w, 0)
      if (total <= availableTableWidth || headerFontSize <= 6) break
      headerFontSize -= 0.5
    }
    const columnStyles = Object.fromEntries(
      headLabels.map((_, i) => [i, i === photoColIndex
        ? { minCellWidth: colMinWidths[i], minCellHeight: PHOTO_IMG_SIZE + 8, halign: 'center' }
        : { minCellWidth: colMinWidths[i] }])
    )

    autoTable(doc, {
      head: [headLabels],
      body: bodyRows,
      startY: startY + 8,
      margin: { top: HEADER_H, left: 36, right: 36, bottom: 26 },
      styles: { font: FONT, fontSize: 7.5, cellPadding: 3, valign: 'middle', overflow: 'linebreak', halign: ar ? 'right' : 'left', lineColor: [230, 210, 210], lineWidth: 0.5 },
      headStyles: { font: FONT, fontSize: headerFontSize, fillColor: SO_RED, textColor: 255, fontStyle: 'bold', halign: ar ? 'right' : 'left' },
      alternateRowStyles: { fillColor: accentTint },
      columnStyles,
      showHead: 'everyPage',
      didDrawPage: drawHeader,
      didParseCell: (data) => {
        if (data.column.index === photoColIndex) return
        if (!ar) return
        data.cell.styles.halign = 'right'
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === photoColIndex) {
          const dataUrl = photoUrls[data.row.index]
          const size = PHOTO_IMG_SIZE
          const x = data.cell.x + (data.cell.width - size) / 2
          const y = data.cell.y + (data.cell.height - size) / 2
          safeAddImage(doc, dataUrl, x, y, size, size)
        }
      },
    })
    return doc.lastAutoTable.finalY + 26
  }

  drawHeader()

  // ── Coaches — always included, fixed field set, independent of the
  // athlete column selection. ──
  const coachColumns = ['name', 'designation', 'status']
  const coachLabels = { name: L('Name','الاسم'), designation: L('Designation','المسمى الوظيفي'), status: L('Status','الحالة') }
  const coachGetters = {
    name: c => ar && c.name_ar ? c.name_ar : c.name,
    designation: c => (ar && c.designation_ar ? c.designation_ar : c.designation) || '',
    status: c => statusLabel(effectiveStatus(c)),
  }
  const coachHeadLabels = ar
    ? [...coachColumns.map(k => coachLabels[k]).reverse(), L('Photo','الصورة')]
    : [L('Photo','الصورة'), ...coachColumns.map(k => coachLabels[k])]
  const coachPhotoColIndex = ar ? coachColumns.length : 0
  const coachBody = soCoaches.map(c => {
    const cells = coachColumns.map(k => safeStr(coachGetters[k](c)))
    return ar ? ['', ...cells.reverse()] : ['', ...cells]
  })

  let y = HEADER_H + 22
  y = drawTable(y, 'Coaches', 'المدربون', coachPhotoColIndex, coachHeadLabels, coachBody, coachPhotos, [252, 235, 235])

  if (y > doc.internal.pageSize.getHeight() - 120) {
    doc.addPage()
    y = HEADER_H + 22
  }

  // ── Athletes — only the columns selected in the export modal. Photo is
  // paired immediately beside the name columns (Arabic Name before
  // English Name, reading right-to-left) exactly like the Athletes list
  // PDF's own pairing rule — nothing about the selected set is hardcoded.
  const ATHLETE_GETTERS = {
    name: a => a.name || '',
    name_ar: a => a.name_ar || '',
    nationality: a => translateCountry(a.nationality, ar ? 'ar' : 'en'),
    classification: a => a.classification || '',
    gender: a => a.gender ? (ar ? (a.gender==='Male'?'ذكر':'أنثى') : a.gender) : '',
    dob: a => a.dob || '',
    age: a => a.age ?? '',
    status: a => statusLabel(effectiveStatus(a)),
    medical_status: a => a.medical_status || '',
    qss_number: a => a.qss_number || '',
  }
  const selectedDataCols = SO_ATHLETE_COLS.filter(c => !c.isPhoto && selectedColKeys.includes(c.key))
  const includePhoto = selectedColKeys.includes('photo')

  let orderedDataCols
  if (ar) {
    const others = selectedDataCols.filter(c => c.key !== 'name' && c.key !== 'name_ar')
    const reversedOthers = [...others].reverse()
    const nameGroup = [
      selectedDataCols.find(c => c.key === 'name'),
      selectedDataCols.find(c => c.key === 'name_ar'),
    ].filter(Boolean)
    orderedDataCols = [...reversedOthers, ...nameGroup]
  } else {
    orderedDataCols = selectedDataCols
  }

  const athleteHeadLabels = includePhoto
    ? (ar ? [...orderedDataCols.map(c => c.labelAr), L('Photo','الصورة')] : [L('Photo','الصورة'), ...orderedDataCols.map(c => c.labelEn)])
    : orderedDataCols.map(c => ar ? c.labelAr : c.labelEn)
  const athletePhotoColIndex = includePhoto ? (ar ? orderedDataCols.length : 0) : -1
  const athleteBody = soAthletes.map(a => {
    const cells = orderedDataCols.map(c => safeStr(ATHLETE_GETTERS[c.key]?.(a)))
    if (!includePhoto) return cells
    return ar ? ['', ...cells] : ['', ...cells]
  })

  if (orderedDataCols.length > 0 || includePhoto) {
    drawTable(y, 'Athletes', 'الرياضيون', athletePhotoColIndex, athleteHeadLabels, athleteBody, athletePhotos, [253, 245, 245])
  }

  const date = new Date().toISOString().slice(0, 10)
  doc.save(`SO_${ar ? 'الأولمبياد_الخاص' : 'Special_Olympics'}_${date}.pdf`)
}
