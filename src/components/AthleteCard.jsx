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
<html lang="ar">
<head>
<meta charset="UTF-8"/>
<title>${athlete.name_ar || athlete.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #aaa;
    font-family: Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
    padding: 40px 20px;
    direction: rtl;
  }

  .card {
    width: 420px;
    background: #fff;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 4px 24px rgba(0,0,0,0.25);
  }

  /* ── FRONT TOP HEADER ── */
  .front-header {
    display: flex;
    align-items: stretch;
  }
  .hdr-logo {
    width: 88px;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    flex-shrink: 0;
  }
  .hdr-logo img { width: 72px; height: 80px; object-fit: contain; }
  .hdr-title {
    flex: 1;
    background: #8B1A1A;
    color: #fff;
    text-align: center;
    font-size: 17px;
    font-weight: bold;
    line-height: 1.6;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 4px;
  }

  /* ── NAME ── */
  .front-name {
    text-align: center;
    font-size: 20px;
    font-weight: bold;
    color: #000;
    padding: 14px 20px 10px;
  }

  /* ── FRONT BODY: photo LEFT, info RIGHT ── */
  /*
     Template layout (LTR visual):
     [PHOTO]  [INFO TABLE with labels on right, values on left]
     [QSS  ]
  */
  .front-body {
    display: flex;
    align-items: flex-start;
    padding: 4px 16px 18px;
    gap: 16px;
    direction: ltr; /* force visual LTR so photo is truly left */
  }

  /* Photo column — physically LEFT */
  .photo-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
  }
  .photo-frame {
    width: 95px;
    height: 115px;
    background: #c5d8e4;
    border-radius: 3px;
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

  /* Info table — physically RIGHT, RTL text */
  .info-table {
    flex: 1;
    direction: rtl;
  }
  .info-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 5px 0;
    font-size: 14px;
  }
  /* label is on the RIGHT visually in RTL */
  .lbl { font-weight: bold; color: #222; white-space: nowrap; }
  /* value is to the LEFT of the label */
  .val { color: #111; text-align: right; flex: 1; padding-left: 8px; }

  /* ── BACK CARD ── */
  .back-header {
    background: #8B1A1A;
    color: #fff;
    text-align: center;
    font-size: 19px;
    font-weight: bold;
    padding: 11px 10px;
    letter-spacing: 0.5px;
  }
  .back-body {
    background: #fff;
    padding: 20px 18px 24px;
    direction: rtl;
  }
  /* Club logo LEFT, ID text RIGHT */
  .back-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    direction: ltr; /* force LTR so club logo is visually left */
    margin-bottom: 20px;
  }
  .club-logo {
    width: 68px;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .club-logo img { width: 100%; height: 100%; object-fit: contain; }
  .id-block {
    text-align: right;
    direction: rtl;
    flex: 1;
    padding-right: 10px;
  }
  .id-label {
    font-size: 13px;
    font-weight: bold;
    color: #333;
    line-height: 1.5;
    margin-bottom: 6px;
  }
  .id-number {
    font-size: 20px;
    font-weight: bold;
    color: #111;
    direction: ltr;
    letter-spacing: 1px;
  }
  .secretary {
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: #111;
    line-height: 1.8;
    margin-bottom: 12px;
  }
  .sig-box {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 55px;
  }
  .sig-box img { height: 50px; object-fit: contain; }

  @media print {
    body { background: white; padding: 0; gap: 15mm; }
    .card { box-shadow: none; page-break-inside: avoid; break-inside: avoid; }
    .print-btn { display: none !important; }
  }
</style>
</head>
<body>

<!-- ════════════ FRONT ════════════ -->
<div class="card">

  <!-- Header: Qatar logo LEFT, red title, QPC logo RIGHT -->
  <div class="front-header">
    <div class="hdr-logo">
      <img src="${qatarLogo}" alt="Qatar"/>
    </div>
    <div class="hdr-title">الاتحاد القطري لذوي<br/>الاحتياجات الخاصة</div>
    <div class="hdr-logo">
      <img src="${qpcLogo}" alt="QPC"/>
    </div>
  </div>

  <!-- Name -->
  <div class="front-name">${athlete.name_ar || athlete.name}</div>

  <!-- Body: photo LEFT, info RIGHT -->
  <div class="front-body">

    <!-- Photo + QSS — LEFT -->
    <div class="photo-col">
      <div class="photo-frame">
        ${photoSrc
          ? `<img src="${photoSrc}" alt="photo"/>`
          : `<div class="photo-placeholder">👤</div>`}
      </div>
      <div class="qss-badge">${athlete.qss_number || '00000'}</div>
    </div>

    <!-- Info rows — RIGHT -->
    <div class="info-table">
      <div class="info-row"><div class="val">${athlete.club || ''}</div><div class="lbl">النادي</div></div>
      <div class="info-row"><div class="val">${desigAr}</div><div class="lbl">الوظيفة</div></div>
      <div class="info-row"><div class="val">${athlete.age_category || ''}</div><div class="lbl">الفئة</div></div>
      <div class="info-row"><div class="val">${residAr}</div><div class="lbl">الصفة</div></div>
      <div class="info-row"><div class="val">${athlete.dob || ''}</div><div class="lbl">تاريخ الميلاد</div></div>
      <div class="info-row"><div class="val">${SEASON}</div><div class="lbl">الموسم</div></div>
    </div>

  </div>
</div>


<!-- ════════════ BACK ════════════ -->
<div class="card">

  <!-- Red header -->
  <div class="back-header">اللجنة الاولمبية القطرية</div>

  <div class="back-body">

    <!-- Club logo LEFT + ID RIGHT -->
    <div class="back-top">
      <div class="club-logo">
        ${athlete.club_logo ? `<img src="${athlete.club_logo}" alt="club"/>` : ''}
      </div>
      <div class="id-block">
        <div class="id-label">الرقم<br/>الشخصي</div>
        <div class="id-number">${athlete.id_number || '—'}</div>
      </div>
    </div>

    <!-- Secretary + signature -->
    <div class="secretary">
      أمين السر العام للاتحاد القطرى<br/>للاحتياجات الخاصة
    </div>
    <div class="sig-box">
      <img src="${signatureLogo}" alt="sig"/>
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
