import { useState, useMemo } from 'react'
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

export default function SpecialOlympics({ athletes = [], coaches = [], onNav, profile }) {
  const { tx, lang } = useLang()
  const ar = lang === 'ar'
  const [search, setSearch] = useState('')
  const [pdfExporting, setPdfExporting] = useState(false)

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

  async function handleExportPDF() {
    setPdfExporting(true)
    try {
      await exportSpecialOlympicsPDF(soAthletes, soCoaches, lang)
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
          onClick={handleExportPDF}
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
    </div>
  )
}

// ── PDF export — reuses the shared jsPDF image helpers (loadImageAsDataURL/
// safeAddImage from helpers.jsx, the same ones the Athletes list export
// uses) and the same Amiri-font approach for Arabic, rather than
// duplicating that logic. Always builds from whatever athlete/coach arrays
// are passed in at call time — i.e. live data, not a cached snapshot.
async function exportSpecialOlympicsPDF(soAthletes, soCoaches, lang) {
  const ar = lang === 'ar'
  const L = (en, a) => ar ? a : en
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Injured':'مصاب','Under Medical Review':'تحت المراجعة الطبية','Suspended':'موقوف','Retired':'متقاعد'}
  const statusLabel = s => ar ? (STATUS_AR[s] || s || '') : (s || '')

  let arabicFontOk = false
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  if (ar) {
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

  const [qpcLogo, soLogo, athletePhotos, coachPhotos] = await Promise.all([
    loadImageAsDataURL('/logo-qpc.png'),
    loadImageAsDataURL('/logo-so.png'),
    Promise.all(soAthletes.map(a => loadImageAsDataURL(a?.photo_url))),
    Promise.all(soCoaches.map(c => loadImageAsDataURL(c?.photo_url))),
  ])

  function logoBox(dataUrl, maxW, maxH) {
    if (!dataUrl) return { w: 0, h: 0 }
    try {
      const props = doc.getImageProperties(dataUrl)
      const ratio = Math.min(maxW / props.width, maxH / props.height)
      return { w: props.width * ratio, h: props.height * ratio }
    } catch { return { w: 0, h: 0 } }
  }
  const qpcBox = logoBox(qpcLogo, 90, 38)
  const soBox = logoBox(soLogo, 90, 38)

  function drawHeader() {
    const topY = 16
    safeAddImage(doc, qpcLogo, 36, topY, qpcBox.w, qpcBox.h)
    safeAddImage(doc, soLogo, pageWidth - 36 - soBox.w, topY, soBox.w, soBox.h)
    setPdfFont('bold')
    doc.setFontSize(13)
    doc.setTextColor(20, 20, 20)
    doc.text(L('Qatar Paralympic Committee', 'اللجنة البارالمبية القطرية'), pageWidth / 2, topY + 10, { align: 'center' })
    setPdfFont('normal')
    doc.setFontSize(10.5)
    doc.text(L('Special Olympics Report', 'تقرير الأولمبياد الخاص'), pageWidth / 2, topY + 24, { align: 'center' })
    doc.setFontSize(8.5)
    doc.setTextColor(110, 110, 110)
    const exportDate = new Date().toISOString().slice(0, 10)
    doc.text(`${L('Season', 'الموسم')} ${getCurrentSeason()}  •  ${L('Export date', 'تاريخ التصدير')}: ${exportDate}`, pageWidth / 2, topY + 36, { align: 'center' })
    doc.setDrawColor(210, 210, 210)
    doc.line(36, topY + 46, pageWidth - 36, topY + 46)
  }

  const HEADER_H = 70
  drawHeader()

  // Summary line
  setPdfFont('bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  const summary = `${L('Total Athletes', 'إجمالي الرياضيين')}: ${soAthletes.length}    ${L('Total Coaches', 'إجمالي المدربين')}: ${soCoaches.length}`
  doc.text(summary, ar ? pageWidth - 36 : 36, HEADER_H, { align: ar ? 'right' : 'left' })

  const PHOTO_COL_W = 24
  const PHOTO_IMG_SIZE = 18

  function buildTable(startY, titleEn, titleAr, rows, photoUrls, cols) {
    setPdfFont('bold')
    doc.setFontSize(11)
    doc.setTextColor(0, 133, 199)
    doc.text(L(titleEn, titleAr), ar ? pageWidth - 36 : 36, startY, { align: ar ? 'right' : 'left' })

    const head = ar
      ? [[...cols.map(c => c.label).reverse(), L('Photo','الصورة')]]
      : [[L('Photo','الصورة'), ...cols.map(c => c.label)]]
    const body = rows.map((r, i) => {
      const cells = cols.map(c => String(c.get(r) ?? ''))
      return ar ? ['', ...cells.reverse()] : ['', ...cells]
    })
    const photoColIndex = ar ? cols.length : 0

    autoTable(doc, {
      head,
      body,
      startY: startY + 8,
      margin: { top: HEADER_H, left: 36, right: 36, bottom: 26 },
      styles: { font: FONT, fontSize: 8, cellPadding: 3, valign: 'middle', overflow: 'linebreak', halign: ar ? 'right' : 'left', lineColor: [225,228,232], lineWidth: 0.5 },
      headStyles: { font: FONT, fillColor: [0,133,199], textColor: 255, fontStyle: 'bold', halign: ar ? 'right' : 'left' },
      alternateRowStyles: { fillColor: [246,248,250] },
      columnStyles: { [photoColIndex]: { cellWidth: PHOTO_COL_W, minCellHeight: PHOTO_COL_W, halign: 'center' } },
      showHead: 'everyPage',
      didDrawPage: drawHeader,
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
    return doc.lastAutoTable.finalY + 24
  }

  const athleteCols = [
    { label: L('Name','الاسم'), get: a => ar && a.name_ar ? a.name_ar : a.name },
    { label: L('Nationality','الجنسية'), get: a => translateCountry(a.nationality, ar ? 'ar' : 'en') },
    { label: L('Classification','التصنيف'), get: a => a.classification || '' },
    { label: L('Status','الحالة'), get: a => statusLabel(effectiveStatus(a)) },
  ]
  const coachCols = [
    { label: L('Name','الاسم'), get: c => ar && c.name_ar ? c.name_ar : c.name },
    { label: L('Nationality','الجنسية'), get: c => translateCountry(c.nationality, ar ? 'ar' : 'en') },
    { label: L('Status','الحالة'), get: c => statusLabel(effectiveStatus(c)) },
  ]

  let y = buildTable(HEADER_H + 20, 'Athletes', 'الرياضيون', soAthletes, athletePhotos, athleteCols)
  if (y > doc.internal.pageSize.getHeight() - 100) {
    doc.addPage()
    y = HEADER_H + 20
  }
  buildTable(y, 'Coaches', 'المدربون', soCoaches, coachPhotos, coachCols)

  const date = new Date().toISOString().slice(0, 10)
  doc.save(`QPC_${ar ? 'الأولمبياد_الخاص' : 'Special_Olympics'}_${date}.pdf`)
}
