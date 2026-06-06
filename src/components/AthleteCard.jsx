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
  'General Assembly Member': 'عضو جمعية عمومية',
  'Expert': 'خبير في',
}

const RESIDENCY_AR = {
  'Qatari Male': 'قطري', 'Qatari Female': 'قطرية',
  'Resident Male': 'مقيم', 'Resident Female': 'مقيمة',
  'Professional Male': 'محترف', 'Professional Female': 'محترفة',
  'Born in Qatar': 'مواليد قطر', 'Qatari Mother': 'أم قطرية',
}

function formatDate(d) {
  if (!d) return '—'
  return d
}

export function generateAthleteCard(athlete) {
  const desigAr = DESIGNATION_AR[athlete.designation] || athlete.designation || 'لاعب'
  const residAr = RESIDENCY_AR[athlete.residency_status] || athlete.residency_status || ''
  const photoSrc = athlete.photo_url || ''
  const dob = formatDate(athlete.dob)

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Arial', sans-serif;
    background: #f0f0f0;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }
  .card {
    width: 420px;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    font-family: Arial, sans-serif;
  }
  /* TOP HEADER */
  .header {
    background: #8B1A1A;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }
  .header-logo { width: 60px; height: 60px; object-fit: contain; }
  .header-title {
    color: #fff;
    font-size: 17px;
    font-weight: bold;
    text-align: center;
    line-height: 1.5;
    flex: 1;
  }
  .header-logo-right { width: 60px; height: 70px; object-fit: contain; }

  /* NAME */
  .name-section {
    text-align: center;
    padding: 14px 10px 8px;
    font-size: 20px;
    font-weight: bold;
    color: #111;
    min-height: 50px;
  }

  /* MIDDLE CONTENT */
  .middle {
    display: flex;
    gap: 0;
    padding: 0 14px 14px;
    align-items: flex-start;
  }

  /* INFO TABLE */
  .info-table {
    flex: 1;
    border-collapse: collapse;
    font-size: 13px;
  }
  .info-table td {
    padding: 5px 4px;
    border-bottom: 1px solid #eee;
    vertical-align: middle;
  }
  .info-table .label {
    color: #555;
    font-weight: bold;
    white-space: nowrap;
    text-align: right;
    padding-right: 8px;
    width: 90px;
  }
  .info-table .value {
    color: #111;
    font-weight: 500;
    text-align: right;
  }

  /* PHOTO SECTION */
  .photo-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-right: 14px;
    flex-shrink: 0;
  }
  .photo-box {
    width: 90px;
    height: 110px;
    border: 2px solid #ccc;
    border-radius: 6px;
    overflow: hidden;
    background: #e8e8e8;
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
    font-size: 40px;
    color: #aaa;
  }
  .qss-badge {
    background: #8B1A1A;
    color: #fff;
    font-size: 15px;
    font-weight: bold;
    padding: 5px 14px;
    border-radius: 4px;
    width: 90px;
    text-align: center;
    letter-spacing: 1px;
  }

  /* SEPARATOR LINE */
  .separator {
    height: 3px;
    background: linear-gradient(to right, #8B1A1A, #c0392b);
    margin: 0 14px;
  }

  /* BOTTOM SECTION */
  .bottom {
    background: #8B1A1A;
    padding: 8px 14px;
    text-align: center;
  }
  .bottom-title {
    color: #fff;
    font-size: 18px;
    font-weight: bold;
    letter-spacing: 1px;
  }

  .bottom-content {
    background: #fff;
    padding: 12px 14px;
  }
  .id-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }
  .id-label {
    font-size: 12px;
    color: #555;
    font-weight: bold;
    text-align: right;
    line-height: 1.4;
  }
  .id-value {
    font-size: 18px;
    font-weight: bold;
    color: #111;
    direction: ltr;
    letter-spacing: 1px;
  }
  .club-logo {
    width: 60px;
    height: 60px;
    object-fit: contain;
  }
  .secretary {
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    color: #222;
    line-height: 1.6;
    margin-bottom: 8px;
  }
  .signature {
    text-align: center;
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .signature img {
    height: 45px;
    object-fit: contain;
  }

  @media print {
    body { background: white; padding: 0; }
    .card { box-shadow: none; }
    .print-btn { display: none; }
  }
</style>
</head>
<body>
<div class="card">
  <!-- HEADER -->
  <div class="header">
    <img class="header-logo" src="${qpcLogo}" alt="QPC" />
    <div class="header-title">الاتحاد القطري لذوي<br/>الاحتياجات الخاصة</div>
    <img class="header-logo-right" src="${qatarLogo}" alt="Qatar" />
  </div>

  <!-- NAME -->
  <div class="name-section">${athlete.name_ar || athlete.name}</div>

  <!-- MIDDLE: INFO + PHOTO -->
  <div class="middle">
    <table class="info-table">
      <tr>
        <td class="label">النادي</td>
        <td class="value">${athlete.club || '—'}</td>
      </tr>
      <tr>
        <td class="label">الوظيفة</td>
        <td class="value">${desigAr}</td>
      </tr>
      <tr>
        <td class="label">الفئة</td>
        <td class="value">${athlete.age_category || '—'}</td>
      </tr>
      <tr>
        <td class="label">الصفة</td>
        <td class="value">${residAr}</td>
      </tr>
      <tr>
        <td class="label">تاريخ الميلاد</td>
        <td class="value">${dob}</td>
      </tr>
      <tr>
        <td class="label">الموسم</td>
        <td class="value">${SEASON}</td>
      </tr>
    </table>

    <!-- PHOTO + QSS -->
    <div class="photo-section">
      <div class="photo-box">
        ${photoSrc
          ? `<img src="${photoSrc}" alt="${athlete.name}" />`
          : `<div class="photo-placeholder">👤</div>`
        }
      </div>
      <div class="qss-badge">${athlete.qss_number || '—'}</div>
    </div>
  </div>

  <div class="separator"></div>

  <!-- BOTTOM HEADER -->
  <div class="bottom">
    <div class="bottom-title">اللجنة الاولمبية القطرية</div>
  </div>

  <!-- BOTTOM CONTENT -->
  <div class="bottom-content">
    <div class="id-row">
      <div style="text-align:right">
        <div class="id-label">الرقم<br/>الشخصي</div>
      </div>
      <div class="id-value">${athlete.id_number || '—'}</div>
    </div>

    <div class="secretary">
      أمين السر العام للاتحاد القطرى<br/>للاحتياجات الخاصة
    </div>
    <div class="signature">
      <img src="${signatureLogo}" alt="signature" />
    </div>
  </div>
</div>

<div class="print-btn" style="text-align:center;margin-top:20px">
  <button onclick="window.print()" style="padding:10px 30px;background:#8B1A1A;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-family:Arial">
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
