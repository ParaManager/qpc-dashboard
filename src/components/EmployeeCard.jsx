import { useLang } from '../lib/LangContext.jsx'

const DESIGNATION_AR = {
  'Coach':'مدرب','Assistant Coach':'مدرب مساعد','Technical Expert':'خبير فني',
  'Physiotherapist':'معالج فيزيائي','Doctor':'طبيب','Secretary General':'الأمين العام',
  'Executive Manager':'مدير تنفيذي','Administration Secretary':'سكرتير إداري',
  'Secretary Assistant':'مساعد سكرتير','Administrative National Team':'إداري الفريق الوطني',
  'Administrative Youth Team':'إداري فريق الشباب',
  'Administrative Center & Development':'إداري المركز والتطوير',
  'Accountant':'محاسب','Public Relation Officer':'مسؤول علاقات عامة',
  'Receptionist':'موظف استقبال','Board Member':'عضو مجلس إدارة',
  'Official':'مسؤول','Delegate':'مندوب','Employee':'موظف',
  'Store Keeper':'أمين مخزن','Waiter':'نادل','Worker':'عامل','Driver':'سائق',
}

export function generateEmployeeCard(emp) {
  const desigAr = emp.designation_ar || DESIGNATION_AR[emp.designation] || emp.designation || ''
  const staffId = emp.employee_number || '0000'
  const jobId   = emp.job_id          || '0000'
  const qssNum  = emp.qss_number      || '0000'
  const phone   = emp.phone           || '+974 44040200'
  const email   = emp.email           || 'info@qpc.qa'
  const photo   = emp.photo_url       || ''
  const _fullName = emp.name || 'Full Name'
  const _nameParts = _fullName.trim().split(/\s+/)
  const name = _nameParts.length >= 2
    ? _nameParts[0] + ' ' + _nameParts[_nameParts.length - 1]
    : _fullName
  const nameAr  = emp.name_ar         || 'الاسم الكامل'
  const posEn   = emp.designation     || 'Position Name'
  const posAr   = desigAr             || 'المسمى الوظيفي'
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '-')

  // Absolute origin so logo <img> srcs resolve correctly inside the popup
  // (popup opened via document.write has no implicit base URL).
  const origin = window.location.origin

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=760"/>
<title>ID Card – ${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }

/* ─── SCREEN ─── */
html, body {
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}
body {
  background: #c0bbb4;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  padding: 40px 24px;
}
.btns { display: flex; gap: 10px; }
.btn { padding: 9px 22px; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; }

/* ── CARD ── */
.card {
  width: 760px;
  height: 460px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background: #ffffff;
  flex-shrink: 0;
  box-shadow:
    0 1px 0 rgba(255,255,255,.9) inset,
    0 4px 8px rgba(0,0,0,.08),
    0 16px 40px rgba(0,0,0,.18),
    0 40px 80px rgba(0,0,0,.12);
}

/* ── DIAGONAL CRIMSON BAND (left) ── */
.diag-band {
  position: absolute;
  top: 0; left: 0;
  width: 260px;
  height: 100%;
  background: #7b1325;
  clip-path: polygon(0 0, 230px 0, 182px 100%, 0 100%);
  z-index: 1;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.diag-band::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(255,255,255,.04) 0px,
    rgba(255,255,255,.04) 1px,
    transparent 1px,
    transparent 10px
  );
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.diag-gold {
  position: absolute;
  top: 0; left: 0;
  width: 260px;
  height: 100%;
  clip-path: polygon(232px 0, 242px 0, 192px 100%, 184px 100%);
  background: linear-gradient(180deg, #f0d060, #c9a84c 50%, #8b6500);
  z-index: 2;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ── PHOTO ── */
.photo-wrap {
  position: absolute;
  top: 44px; left: 26px;
  width: 152px; height: 152px;
  border-radius: 50%;
  border: 4px solid #c9a84c;
  overflow: hidden;
  background: #c8cacd;
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0,0,0,.3), 0 0 0 2px rgba(201,168,76,.25);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.photo-wrap img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }

/* Staff ID pill below photo */
.staff-pill {
  position: absolute;
  top: 210px; left: 26px;
  width: 152px;
  text-align: center;
  z-index: 10;
}
.staff-pill .lbl {
  font-size: 8px; font-weight: 700;
  color: rgba(255,255,255,.55);
  letter-spacing: .16em;
  display: block; margin-bottom: 3px;
}
.staff-pill .val {
  font-size: 18px; font-weight: 800;
  color: #c9a84c;
  letter-spacing: .04em;
  display: block;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* ID chips */
.id-chips {
  display: flex; gap: 72px;
  padding: 8px 24px;
  border-top: 1px solid #edeae4;
  border-bottom: 1px solid #edeae4;
  flex-shrink: 0;
}
.id-chip { display: flex; flex-direction: column; gap: 1px; }
.id-chip .cl { font-size: 11px; color: #888; font-weight: 700; letter-spacing: .08em; }
.id-chip .cv { font-size: 13px; font-weight: 700; color: #1a2340; }

/* ── RIGHT CONTENT PANEL ── */
.right {
  position: absolute;
  top: 0; left: 244px; right: 0; bottom: 0;
  display: flex; flex-direction: column;
  z-index: 5;
}

/* Logos strip */
.logos-strip {
  height: 90px;
  display: flex; align-items: center;
  padding: 0 24px 0 44px;
  gap: 0;
  border-bottom: 1px solid #edeae4;
  position: relative;
  flex-shrink: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.logos-strip::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #c9a84c, #f0d060 40%, #c9a84c 70%, rgba(201,168,76,.1));
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.logo-img { object-fit: contain; display: block; }
.logo-sep {
  width: 1px; height: 58px;
  background: linear-gradient(180deg, transparent, rgba(201,168,76,.65), transparent);
  margin: 0 22px; flex-shrink: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Name + position */
.content {
  flex: 1;
  padding: 20px 24px 0;
  position: relative;
  overflow: hidden;
}
.content::after {
  content: 'QPC';
  position: absolute;
  right: 12px; bottom: 60px;
  font-size: 72px; font-weight: 900;
  color: #7b1325; opacity: .025;
  line-height: 1; pointer-events: none;
  font-family: 'Inter', Arial, sans-serif;
}
.hex-pattern {
  position: absolute;
  right: 0; top: 0;
  width: 140px; height: 180px;
  opacity: .045;
  background-image: radial-gradient(circle, #7b1325 1px, transparent 1px);
  background-size: 14px 14px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.eyebrow {
  font-size: 7.5px; font-weight: 700;
  color: #c9a84c; letter-spacing: .22em;
  margin-bottom: 12px; position: relative; z-index: 1;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.en-name {
  font-size: 28px; font-weight: 900;
  color: #1a2340; line-height: 1; letter-spacing: -.025em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  position: relative; z-index: 1; max-width: 100%;
}
.ar-name {
  font-size: 28px; font-weight: 900;
  color: #1a2340; margin-top: 4px;
  direction: rtl; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  position: relative; z-index: 1;
  line-height: 1.1; max-width: 100%;
}
.rule {
  display: flex; align-items: center; gap: 8px;
  margin: 12px 0; position: relative; z-index: 1;
}
.rule-bar {
  height: 2.5px; width: 44px; background: #c9a84c; border-radius: 2px; flex-shrink: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.rule-line { height: 1px; flex: 1; background: #edeae4; }
.rule-dot {
  width: 10px; height: 10px; border-radius: 50%; background: #c9a84c; flex-shrink: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.pos-en {
  font-size: 24px; font-weight: 700; color: #7b1325;
  position: relative; z-index: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.pos-ar {
  font-size: 24px; font-weight: 700; color: #7b1325; margin-top: 4px;
  direction: rtl; text-align: left;
  position: relative; z-index: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* Contact footer */
.contact {
  border-top: 1px solid #edeae4;
  padding: 12px 24px 16px;
  display: flex; gap: 20px;
  flex-shrink: 0;
}
.contact-row { display: flex; align-items: center; gap: 10px; }
.contact-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: #7b1325;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.contact-icon svg { width: 14px; height: 14px; stroke: white; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.contact-text { font-size: 13px; color: #333; font-weight: 500; }

/* Bottom gold bar */
.gold-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, #7b1325, #c9a84c 25%, #f0d060 50%, #c9a84c 75%, #7b1325);
  z-index: 20;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}

/* ─── PRINT ─── */
@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    width: 760px;
    height: 460px;
    overflow: hidden;
    background: white !important;
    margin: 0;
    padding: 0;
    display: block;
    min-height: unset;
    gap: 0;
  }
  .btns { display: none !important; }
  .card {
    width: 760px !important;
    height: 460px !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    box-shadow: none !important;
    border-radius: 0 !important;
    border: none !important;
    overflow: hidden !important;
  }
  @page { size: 572pt 346pt; margin: 0; }
}
</style>
</head>
<body>

<div class="btns">
  <button class="btn" id="dlBtn" style="background:#7b1325;color:white">⬇ Download PNG</button>
  <button class="btn" onclick="window.print()" style="background:#2d3748;color:white">🖨 Print</button>
  <button class="btn" onclick="window.close()" style="background:white;color:#555;border:1px solid #ddd">← Back</button>
</div>

<div class="card" id="card">

  <div class="diag-band"></div>
  <div class="diag-gold"></div>

  <div class="photo-wrap">
    ${photo
      ? `<img src="${photo}" crossorigin="anonymous" alt="${name}"/>`
      : `<svg viewBox="0 0 100 115" width="100%" height="100%" style="padding-top:8%">
           <circle cx="50" cy="34" r="25" fill="#9aa0a6"/>
           <ellipse cx="50" cy="97" rx="40" ry="28" fill="#9aa0a6"/>
         </svg>`
    }
  </div>

  <div class="staff-pill">
    <span class="lbl">STAFF ID</span>
    <span class="val">${staffId}</span>
  </div>

  <div class="right">

    <div class="logos-strip">
      <img src="${origin}/logo-qpc.png"   alt="QPC"             class="logo-img" style="height:70px;width:auto;max-width:90px"  onerror="this.style.display='none'"/>
      <div class="logo-sep"></div>
      <img src="${origin}/logo-qatar.png" alt="Qatar"            class="logo-img" style="height:74px;width:auto;max-width:76px"  onerror="this.style.display='none'"/>
      <div class="logo-sep"></div>
      <img src="${origin}/logo-so.png"    alt="Special Olympics" class="logo-img" style="height:46px;width:auto;max-width:150px" onerror="this.style.display='none'"/>
    </div>

    <div class="content">
      <div class="hex-pattern"></div>
      <div class="eyebrow">QATAR PARALYMPIC COMMITTEE  ·  بطاقة موظف</div>
      <div class="en-name">${name}</div>
      <div class="ar-name">${nameAr}</div>
      <div class="rule">
        <div class="rule-bar"></div>
        <div class="rule-line"></div>
        <div class="rule-dot"></div>
      </div>
      <div class="pos-en">${posEn}</div>
      <div class="pos-ar">${posAr}</div>
    </div>

    <div class="id-chips">
      <div class="id-chip">
        <span class="cl">JOB ID</span>
        <span class="cv">${jobId}</span>
      </div>
      <div class="id-chip">
        <span class="cl">QSS NUMBER</span>
        <span class="cv">${qssNum}</span>
      </div>
    </div>

    <div class="contact">
      <div class="contact-row">
        <div class="contact-icon">
          <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.63 19 19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-2.93-8.19A2 2 0 0 1 3.56 1.7h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.4a16 16 0 0 0 5.99 6l.91-.91a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        </div>
        <span class="contact-text">${phone}</span>
      </div>
      <div class="contact-row">
        <div class="contact-icon">
          <svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 6 12 13 2 6"/></svg>
        </div>
        <span class="contact-text">${email}</span>
      </div>
    </div>

  </div>

  <div class="gold-bar"></div>
</div>

<script>
(function () {
  var dlBtn = document.getElementById('dlBtn');

  dlBtn.onclick = function () {
    dlBtn.textContent = 'Generating…';
    dlBtn.disabled = true;

    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

    s.onerror = function () {
      alert('Could not load html2canvas. Check your internet connection.');
      dlBtn.textContent = '⬇ Download PNG';
      dlBtn.disabled = false;
    };

    s.onload = function () {
      // Wait for fonts + all images before capture so nothing is blank
      var fontReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
      var imgs = Array.from(document.querySelectorAll('img'));
      var imgReady = Promise.all(imgs.map(function (img) {
        if (img.complete) return Promise.resolve();
        return new Promise(function (res) { img.onload = res; img.onerror = res; });
      }));

      Promise.all([fontReady, imgReady]).then(function () {
        html2canvas(document.getElementById('card'), {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: 760,
          height: 460,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 760,
          windowHeight: 460,
          logging: false,
          imageTimeout: 15000,
          onclone: function (doc) {
            // Prevent any scroll offset inside the cloned document
            doc.documentElement.style.overflow = 'hidden';
            doc.body.style.overflow = 'hidden';
            doc.body.style.padding = '0';
            doc.body.style.margin = '0';
          }
        }).then(function (canvas) {
          var a = document.createElement('a');
          a.download = '${safeName}-ID-Card.png';
          a.href = canvas.toDataURL('image/png');
          a.click();
          dlBtn.textContent = '⬇ Download PNG';
          dlBtn.disabled = false;
        }).catch(function (e) {
          alert('Download error: ' + e.message);
          dlBtn.textContent = '⬇ Download PNG';
          dlBtn.disabled = false;
        });
      });
    };

    document.head.appendChild(s);
  };
})();
</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    alert('Popup blocked — please allow popups for this site and try again.')
    return
  }
  win.document.write(html)
  win.document.close()
}

export default function EmployeeCardButton({ emp }) {
  const { lang } = useLang()
  const ar = lang === 'ar'
  return (
    <button
      onClick={() => generateEmployeeCard(emp)}
      className="action-btn"
      style={{ borderColor:'#7b1325', color:'#7b1325', padding:'5px 12px', display:'flex', alignItems:'center', gap:6 }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f9e5ea' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}
    >
      <i className="ti ti-id-badge" style={{ fontSize:14 }} />
      <span>{ar ? 'بطاقة الموظف' : 'ID Card'}</span>
    </button>
  )
}
