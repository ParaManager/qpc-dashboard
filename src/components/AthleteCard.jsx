import { qpcLogo, qatarLogo, signatureLogo } from '../lib/logos'

const SEASON = '2025 / 2026'

const DESIGNATION_AR = {
  'Player': 'لاعب', 'Female Player': 'لاعبة',
  'Coach': 'مدرب', 'Female Coach': 'مدربة',
  'Referee': 'حكم', 'Female Referee': 'حكمة',
  'Admin Staff': 'جهاز إداري', 'Technical Staff': 'جهاز في',
  'Medical Staff': 'جهاز طبي',
  'Board Member': 'عضو مجلس إدارة', 'Female Board Member': 'عضوة مجلس إدارة',
  'Member': 'عضو', 'Female Member': 'عضوة',
  'Employee': 'موظف', 'Female Employee': 'موظفة',
  'Expert': 'خبير في',
}

const RESIDENCY_AR = {
  'Qatari Male': 'قطري', 'Qatari Female': 'قطرية',
  'Resident Male': 'مقيم', 'Resident Female': 'مقيمة',
  'Professional Male': 'محترف', 'Professional Female': 'محترفة',
  'Born in Qatar': 'مواليد قطر', 'Qatari Mother': 'أم قطرية',
}

export function generateAthleteCard(athlete) {
  const desigAr  = DESIGNATION_AR[athlete.designation] || athlete.designation || 'لاعب'
  const residAr  = RESIDENCY_AR[athlete.residency_status] || athlete.residency_status || ''
  const photoSrc = athlete.photo_url || ''

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>${athlete.name_ar || athlete.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #b0b0b0;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
    padding: 40px 20px;
  }

  /* ═══════════════════════════
     CARD BASE
  ═══════════════════════════ */
  .card {
    width: 420px;
    background: #fff;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.22);
  }

  /* ═══════════════════════════
     FRONT CARD
  ═══════════════════════════ */

  /* Top header row */
  .front-header {
    display: flex;
    align-items: stretch;
    background: #fff;
    padding: 0;
  }
  .front-header .logo-left {
    width: 90px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
  }
  .front-header .logo-left img {
    width: 72px;
    height: 80px;
    object-fit: contain;
  }
  .front-header .title-center {
    flex: 1;
    background: #8B1A1A;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 17px;
    font-weight: bold;
    line-height: 1.55;
    padding: 10px 6px;
  }
  .front-header .logo-right {
    width: 90px;
    padding: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
  }
  .front-header .logo-right img {
    width: 72px;
    height: 82px;
    object-fit: contain;
  }

  /* Name row */
  .front-name {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    color: #111;
    padding: 14px 16px 10px;
    background: #fff;
  }

  /* Body: photo left + info right */
  .front-body {
    display: flex;
    flex-direction: row-reverse;
    align-items: flex-start;
    padding: 4px 16px 18px;
    gap: 14px;
    background: #fff;
    direction: rtl;
  }

  /* Info table (right side in RTL = visually right) */
  .front-info {
    flex: 1;
    direction: rtl;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 5px 0;
    font-size: 14px;
  }
  .info-label {
    font-weight: bold;
    color: #222;
    white-space: nowrap;
    padding-right: 0;
  }
  .info-value {
    color: #111;
    font-weight: 500;
    text-align: left;
    direction: rtl;
  }

  /* Photo column (left side in RTL = visually left) */
  .front-photo-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }
  .photo-frame {
    width: 95px;
    height: 115px;
    background: #c8dde8;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .photo-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
  }
  .photo-placeholder {
    font-size: 52px;
    color: #5b8fa8;
    line-height: 1;
  }
  .qss-badge {
    width: 95px;
    background: #8B1A1A;
    color: #fff;
    font-size: 15px;
    font-weight: bold;
    text-align: center;
    padding: 5px 4px;
    border-radius: 3px;
    letter-spacing: 1px;
  }

  /* thin red divider between front sections */
  .red-line {
    height: 4px;
    background: #8B1A1A;
  }

  /* ═══════════════════════════
     BACK CARD
  ═══════════════════════════ */

  /* Red header bar */
  .back-header {
    background: #8B1A1A;
    color: #fff;
    text-align: center;
    font-size: 19px;
    font-weight: bold;
    padding: 11px 10px;
    letter-spacing: 0.5px;
  }

  /* White body */
  .back-body {
    background: #fff;
    padding: 18px 18px 22px;
    direction: rtl;
  }

  /* Club logo + ID row */
  .back-id-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
  }
  .club-logo-area {
    width: 70px;
    height: 70px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .club-logo-area img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .back-id-section {
    text-align: right;
    flex: 1;
    padding-right: 10px;
  }
  .back-id-label {
    font-size: 13px;
    font-weight: bold;
    color: #333;
    line-height: 1.5;
    margin-bottom: 6px;
  }
  .back-id-number {
    font-size: 20px;
    font-weight: bold;
    color: #111;
    direction: ltr;
    text-align: right;
    letter-spacing: 1px;
  }

  /* Secretary */
  .secretary {
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: #111;
    line-height: 1.8;
    margin-bottom: 10px;
  }

  /* Signature */
  .signature {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 55px;
  }
  .signature img {
    height: 50px;
    object-fit: contain;
  }

  /* PRINT */
  @media print {
    body {
      background: white;
      padding: 0;
      gap: 20mm;
    }
    .card {
      box-shadow: none;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .print-btn { display: none !important; }
  }
</style>
</head>
<body>

<!-- ══════════════ FRONT OF CARD ══════════════ -->
<div class="card">

  <!-- Header -->
  <div class="front-header">
    <div class="logo-left">
      <img src="${qatarLogo}" alt="Qatar"/>
    </div>
    <div class="title-center">
      الاتحاد القطري لذوي<br/>الاحتياجات الخاصة
    </div>
    <div class="logo-right">
      <img src="${qpcLogo}" alt="QPC"/>
    </div>
  </div>

  <!-- Name -->
  <div class="front-name">${athlete.name_ar || athlete.name}</div>

  <!-- Body: info + photo -->
  <div class="front-body">

    <!-- Info (right side) -->
    <div class="front-info">
      <div class="info-row">
        <div class="info-label">النادي</div>
        <div class="info-value">${athlete.club || ''}</div>
      </div>
      <div class="info-row">
        <div class="info-label">الوظيفة</div>
        <div class="info-value">${desigAr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">الفئة</div>
        <div class="info-value">${athlete.age_category || ''}</div>
      </div>
      <div class="info-row">
        <div class="info-label">الصفة</div>
        <div class="info-value">${residAr}</div>
      </div>
      <div class="info-row">
        <div class="info-label">تاريخ الميلاد</div>
        <div class="info-value">${athlete.dob || ''}</div>
      </div>
      <div class="info-row">
        <div class="info-label">الموسم</div>
        <div class="info-value">${SEASON}</div>
      </div>
    </div>

    <!-- Photo + QSS (left side) -->
    <div class="front-photo-col">
      <div class="photo-frame">
        ${photoSrc
          ? `<img src="${photoSrc}" alt="photo"/>`
          : `<div class="photo-placeholder">👤</div>`
        }
      </div>
      <div class="qss-badge">${athlete.qss_number || '00000'}</div>
    </div>

  </div>

  <!-- Red divider line -->
  <div class="red-line"></div>

</div>


<!-- ══════════════ BACK OF CARD ══════════════ -->
<div class="card">

  <!-- Red header -->
  <div class="back-header">اللجنة الاولمبية القطرية</div>

  <!-- White body -->
  <div class="back-body">

    <!-- Club logo (left) + ID number (right) -->
    <div class="back-id-row">
      <div class="club-logo-area">
        ${athlete.club_logo ? `<img src="${athlete.club_logo}" alt="${athlete.club}"/>` : ''}
      </div>
      <div class="back-id-section">
        <div class="back-id-label">الرقم<br/>الشخصي</div>
        <div class="back-id-number">${athlete.id_number || '—'}</div>
      </div>
    </div>

    <!-- Secretary + signature -->
    <div class="secretary">
      أمين السر العام للاتحاد القطرى<br/>للاحتياجات الخاصة
    </div>
    <div class="signature">
      <img src="${signatureLogo}" alt="signature"/>
    </div>

  </div>
</div>


<!-- Print button -->
<div class="print-btn" style="text-align:center">
  <button onclick="window.print()"
    style="padding:11px 36px;background:#8B1A1A;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-family:Arial,sans-serif">
    🖨️ طباعة / Print
  </button>
</div>

</body>
</html>`

  return html
}

export default function AthleteCardButton({ athlete }) {
  function handleGenerate() {
    const html = generateAthleteCard(athlete)
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 600)
  }

  return (
    <button
      onClick={handleGenerate}
      className="action-btn"
      style={{ borderColor:'#8B1A1A', color:'#8B1A1A', padding:'5px 12px' }}
      onMouseEnter={e => { e.currentTarget.style.background='#fef2f2' }}
      onMouseLeave={e => { e.currentTarget.style.background='' }}>
      <i className="ti ti-id-badge" style={{ fontSize:14 }} /> Generate Card
    </button>
  )
}
