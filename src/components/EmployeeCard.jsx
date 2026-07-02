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
  const staffId = emp.employee_number ? 'QPC-' + emp.employee_number : '—'
  const jobId   = emp.job_id   || '—'
  const qssNum  = emp.qss_number ? 'QSS-' + emp.qss_number : '—'
  const phone   = emp.phone    || '+974 44040200'
  const email   = emp.email    || 'info@qpc.qa'
  const photo   = emp.photo_url || ''
  const name    = emp.name     || 'Full Name'
  const nameAr  = emp.name_ar  || 'الاسم الكامل'
  const posEn   = emp.designation || 'Position Name'
  const posAr   = desigAr || 'المسمى الوظيفي'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ID Card – ${name}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  background: #c4bfb8;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 40px 24px;
  font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
}
.btns { display: flex; gap: 10px; }
.btn {
  padding: 9px 22px; border: none; border-radius: 8px;
  cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600;
}
/* ── CARD ─────────────────────────────────────────────────── */
.card {
  width: 760px;
  height: 470px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  background: #ffffff;
  box-shadow:
    0 1px 0 rgba(255,255,255,.9) inset,
    0 4px 8px rgba(0,0,0,.08),
    0 16px 40px rgba(0,0,0,.18),
    0 40px 80px rgba(0,0,0,.12);
}

/* ── HEADER ────────────────────────────────────────────────── */
.header {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 128px;
  background: #7b1325;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0 48px;
  z-index: 2;
}
.header::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(255,255,255,.03) 0px,
    rgba(255,255,255,.03) 1px,
    transparent 1px,
    transparent 8px
  );
}
.header::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #7a5c00, #f0d060 22%, #c9a84c 50%, #f0d060 78%, #7a5c00);
}
.logo-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}
.logo-div {
  width: 1px;
  height: 72px;
  background: linear-gradient(180deg, transparent, rgba(201,168,76,.65), transparent);
  margin: 0 36px;
  flex-shrink: 0;
}
.logo-wrap img {
  object-fit: contain;
  display: block;
}

/* ── BODY ──────────────────────────────────────────────────── */
.body {
  position: absolute;
  top: 128px; left: 0; right: 0; bottom: 0;
  display: flex;
}

/* ── LEFT PANEL ─────────────────────────────────────────────── */
.left {
  width: 232px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 26px 18px 22px;
  border-right: 1px solid #edeae4;
  background: #fdfcfa;
}
.photo-ring {
  width: 148px;
  height: 148px;
  border-radius: 50%;
  border: 3.5px solid #c9a84c;
  overflow: hidden;
  background: #e2e4e6;
  flex-shrink: 0;
  box-shadow: 0 2px 12px rgba(0,0,0,.13), 0 0 0 1px rgba(201,168,76,.2);
}
.photo-ring img {
  width: 100%; height: 100%;
  object-fit: cover; object-position: top center;
}
.photo-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
}
.staff-pill {
  margin-top: 16px;
  background: #fdf5e4;
  border: 1.5px solid #c9a84c;
  border-radius: 24px;
  padding: 6px 18px;
  text-align: center;
  box-shadow: 0 1px 4px rgba(201,168,76,.15);
}
.staff-pill .pill-label {
  font-size: 8px; font-weight: 700;
  color: #7a5c00; letter-spacing: .14em;
}
.staff-pill .pill-val {
  font-size: 15px; font-weight: 800;
  color: #7b1325; letter-spacing: .03em; margin-top: 1px;
}
.id-rows { margin-top: 10px; width: 100%; display: flex; flex-direction: column; gap: 5px; }
.id-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 10px;
  background: #fff;
  border: 1px solid #e8e4dc;
  border-radius: 7px;
}
.id-row .id-lbl { font-size: 8px; color: #b0b0b0; letter-spacing: .1em; font-weight: 600; }
.id-row .id-val { font-size: 11.5px; font-weight: 700; color: #1a2340; }

/* ── RIGHT PANEL ────────────────────────────────────────────── */
.right {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 30px 30px 0;
  min-width: 0;
}
.eyebrow {
  font-size: 8px; font-weight: 700;
  color: #c9a84c; letter-spacing: .22em;
  margin-bottom: 14px;
}
.en-name {
  font-size: 32px; font-weight: 900;
  color: #1a2340; line-height: 1;
  letter-spacing: -.025em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ar-name {
  font-size: 18px; font-weight: 500;
  color: #555; margin-top: 6px;
  direction: rtl; text-align: right;
}
.rule {
  margin: 16px 0;
  display: flex; align-items: center; gap: 8px;
}
.rule-bar {
  height: 2.5px; width: 48px;
  background: #c9a84c; border-radius: 2px; flex-shrink: 0;
}
.rule-line { height: 1px; flex: 1; background: #edeae4; }
.pos-en {
  font-size: 18px; font-weight: 700; color: #7b1325;
}
.pos-ar {
  font-size: 14px; color: #888; margin-top: 4px;
  direction: rtl; text-align: right; font-weight: 500;
}
.contact {
  border-top: 1px solid #edeae4;
  padding: 14px 0 18px;
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.contact-row { display: flex; align-items: center; gap: 11px; }
.contact-icon {
  width: 28px; height: 28px; border-radius: 50%;
  background: #7b1325;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.contact-icon svg { width: 14px; height: 14px; stroke: white; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.contact-text { font-size: 13px; color: #333; font-weight: 500; }

/* Bottom gold bar */
.gold-bar {
  position: absolute;
  bottom: 0; left: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, #7a5c00, #f0d060 20%, #c9a84c 50%, #f0d060 80%, #7a5c00);
  z-index: 5;
}

@media print {
  body { background: white; padding: 0; justify-content: flex-start; }
  .btns { display: none !important; }
  .card { box-shadow: none; }
  @page { size: 760px 470px; margin: 0; }
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

  <!-- HEADER: 3 logos only -->
  <div class="header">
    <div class="logo-wrap">
      <img src="/logo-qpc.png" alt="QPC" style="height:92px" onerror="this.style.display='none'"/>
    </div>
    <div class="logo-div"></div>
    <div class="logo-wrap">
      <img src="/logo-qatar.png" alt="Qatar" style="height:96px" onerror="this.style.display='none'"/>
    </div>
    <div class="logo-div"></div>
    <div class="logo-wrap">
      <img src="/logo-so.png" alt="Special Olympics" style="height:56px;filter:brightness(0) invert(1)" onerror="this.style.style='display:none'"/>
    </div>
  </div>

  <!-- BODY -->
  <div class="body">

    <!-- LEFT: photo + IDs -->
    <div class="left">
      <div class="photo-ring">
        ${photo
          ? `<img src="${photo}" alt="${name}"/>`
          : `<div class="photo-placeholder">
               <svg viewBox="0 0 100 115" width="82%" style="padding-top:8%">
                 <circle cx="50" cy="34" r="25" fill="#b0b5ba"/>
                 <ellipse cx="50" cy="97" rx="40" ry="28" fill="#b0b5ba"/>
               </svg>
             </div>`
        }
      </div>

      <div class="staff-pill">
        <div class="pill-label">STAFF ID</div>
        <div class="pill-val">${staffId}</div>
      </div>

      <div class="id-rows">
        <div class="id-row">
          <span class="id-lbl">JOB ID</span>
          <span class="id-val">${jobId}</span>
        </div>
        <div class="id-row">
          <span class="id-lbl">QSS NUMBER</span>
          <span class="id-val">${qssNum}</span>
        </div>
      </div>
    </div>

    <!-- RIGHT: name + position + contact -->
    <div class="right">
      <div class="eyebrow">QATAR PARALYMPIC COMMITTEE &nbsp;·&nbsp; بطاقة موظف</div>

      <div class="en-name">${name}</div>
      <div class="ar-name">${nameAr}</div>

      <div class="rule">
        <div class="rule-bar"></div>
        <div class="rule-line"></div>
      </div>

      <div class="pos-en">${posEn}</div>
      <div class="pos-ar">${posAr}</div>

      <div class="contact">
        <div class="contact-row">
          <div class="contact-icon">
            <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.63 19 19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-2.93-8.19A2 2 0 0 1 3.56 1.7h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.4a16 16 0 0 0 5.99 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
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

  </div>

  <div class="gold-bar"></div>
</div>

<script>
// html2canvas download
document.getElementById('dlBtn').onclick = async () => {
  const btn = document.getElementById('dlBtn');
  btn.textContent = 'Generating…'; btn.disabled = true;
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.onload = async () => {
    try {
      const canvas = await html2canvas(document.getElementById('card'), {
        scale: 2, useCORS: true, backgroundColor: '#ffffff',
        width: 760, height: 470
      });
      const a = document.createElement('a');
      a.download = 'ID-Card-${name.replace(/[^a-zA-Z0-9]/g, '-')}.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch(e) { alert('Download failed: ' + e.message); }
    btn.textContent = '⬇ Download PNG'; btn.disabled = false;
  };
  document.head.appendChild(script);
};
</script>
</body>
</html>`

  const win = window.open('', '_blank')
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
