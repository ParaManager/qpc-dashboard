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
  const desigAr   = DESIGNATION_AR[athlete.designation] || athlete.designation || 'لاعب'
  const residAr   = RESIDENCY_AR[athlete.residency_status] || athlete.residency_status || ''
  const photoSrc  = athlete.photo_url || ''

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>${athlete.name_ar || athlete.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #ccc;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 30px 20px;
    font-family: Arial, sans-serif;
  }

  /* CARD */
  .card {
    width: 380px;
    background: #fff;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 6px 24px rgba(0,0,0,0.25);
  }

  /* ── TOP HEADER ── */
  .top-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    background: #fff;
    gap: 6px;
  }
  .top-header .logo-qpc  { width: 55px; height: 62px; object-fit: contain; }
  .top-header .title-bar {
    flex: 1;
    background: #8B1A1A;
    color: #fff;
    text-align: center;
    font-size: 15px;
    font-weight: bold;
    line-height: 1.5;
    padding: 8px 6px;
    border-radius: 4px;
  }
  .top-header .logo-qatar { width: 50px; height: 65px; object-fit: contain; }

  /* ── NAME ── */
  .name-row {
    text-align: center;
    font-size: 19px;
    font-weight: bold;
    color: #111;
    padding: 12px 16px 6px;
    background: #fff;
  }

  /* ── MIDDLE ── */
  .middle {
    display: flex;
    align-items: flex-start;
    padding: 8px 14px 14px;
    background: #fff;
    gap: 12px;
    direction: rtl;
  }

  /* info side (right) */
  .info-side {
    flex: 1;
    direction: rtl;
  }
  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding: 4px 0;
    font-size: 13px;
  }
  .info-label {
    color: #333;
    font-weight: bold;
    text-align: right;
    min-width: 80px;
  }
  .info-value {
    color: #111;
    font-weight: 500;
    text-align: left;
    flex: 1;
    padding-right: 8px;
  }

  /* photo side (left) */
  .photo-side {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .photo-box {
    width: 85px;
    height: 100px;
    background: #dce8f0;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .photo-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .photo-placeholder {
    font-size: 44px;
    color: #5b8fa8;
  }
  .qss-box {
    background: #8B1A1A;
    color: #fff;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    padding: 4px 0;
    width: 85px;
    border-radius: 3px;
    letter-spacing: 1px;
  }

  /* ── RED DIVIDER ── */
  .red-bar {
    background: #8B1A1A;
    color: #fff;
    text-align: center;
    font-size: 17px;
    font-weight: bold;
    padding: 8px;
    letter-spacing: 1px;
  }

  /* ── BOTTOM ── */
  .bottom {
    background: #fff;
    padding: 14px 16px 18px;
    direction: rtl;
  }
  .bottom-id-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .club-logo-box {
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .club-logo-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .id-section {
    text-align: right;
    flex: 1;
    padding-right: 10px;
  }
  .id-label {
    font-size: 11px;
    color: #555;
    font-weight: bold;
    line-height: 1.4;
  }
  .id-number {
    font-size: 17px;
    font-weight: bold;
    color: #111;
    direction: ltr;
    letter-spacing: 1px;
    margin-top: 4px;
  }
  .secretary {
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    color: #111;
    line-height: 1.7;
    margin-bottom: 6px;
  }
  .sig-box {
    text-align: center;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .sig-box img { height: 44px; object-fit: contain; }

  /* PRINT */
  @media print {
    body { background: white; padding: 0; }
    .card { box-shadow: none; margin: 0 auto; }
    .print-btn { display: none !important; }
  }
</style>
</head>
<body>

<div class="card">

  <!-- TOP HEADER -->
  <div class="top-header">
    <img class="logo-qpc" src="${qpcLogo}" alt="QPC"/>
    <div class="title-bar">الاتحاد القطري لذوي<br/>الاحتياجات الخاصة</div>
    <img class="logo-qatar" src="${qatarLogo}" alt="Qatar"/>
  </div>

  <!-- NAME -->
  <div class="name-row">${athlete.name_ar || athlete.name}</div>

  <!-- MIDDLE -->
  <div class="middle">
    <!-- INFO TABLE (right side) -->
    <div class="info-side">
      <div class="info-row">
        <div class="info-value">${athlete.club || ''}</div>
        <div class="info-label">النادي</div>
      </div>
      <div class="info-row">
        <div class="info-value">${desigAr}</div>
        <div class="info-label">الوظيفة</div>
      </div>
      <div class="info-row">
        <div class="info-value">${athlete.age_category || ''}</div>
        <div class="info-label">الفئة</div>
      </div>
      <div class="info-row">
        <div class="info-value">${residAr}</div>
        <div class="info-label">الصفة</div>
      </div>
      <div class="info-row">
        <div class="info-value">${athlete.dob || ''}</div>
        <div class="info-label">تاريخ الميلاد</div>
      </div>
      <div class="info-row">
        <div class="info-value">${SEASON}</div>
        <div class="info-label">الموسم</div>
      </div>
    </div>

    <!-- PHOTO + QSS (left side) -->
    <div class="photo-side">
      <div class="photo-box">
        ${photoSrc
          ? `<img src="${photoSrc}" alt="photo"/>`
          : `<div class="photo-placeholder">👤</div>`
        }
      </div>
      <div class="qss-box">${athlete.qss_number || '00000'}</div>
    </div>
  </div>

  <!-- RED BAR -->
  <div class="red-bar">اللجنة الاولمبية القطرية</div>

  <!-- BOTTOM -->
  <div class="bottom">
    <div class="bottom-id-row">
      <!-- Club logo placeholder (left) -->
      <div class="club-logo-box">
        ${athlete.club_logo ? `<img src="${athlete.club_logo}" alt="club"/>` : ''}
      </div>
      <!-- ID section (right) -->
      <div class="id-section">
        <div class="id-label">الرقم<br/>الشخصي</div>
        <div class="id-number">${athlete.id_number || '—'}</div>
      </div>
    </div>

    <div class="secretary">
      أمين السر العام للاتحاد القطرى<br/>للاحتياجات الخاصة
    </div>
    <div class="sig-box">
      <img src="${signatureLogo}" alt="signature"/>
    </div>
  </div>

</div>

<div class="print-btn" style="margin-top:20px;text-align:center">
  <button onclick="window.print()"
    style="padding:10px 32px;background:#8B1A1A;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-family:Arial,sans-serif">
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
