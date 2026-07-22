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
  const origin  = window.location.origin

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
html, body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; }
body {
  background: #c0bbb4;
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 22px; padding: 40px 24px;
}
.btns { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.btn {
  padding: 9px 22px; border: none; border-radius: 8px;
  cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600;
}
.btn:disabled { opacity: .55; cursor: default; }

/* ── CARD ── */
.card {
  width: 760px; height: 460px;
  border-radius: 16px; overflow: hidden;
  position: relative; background: #ffffff; flex-shrink: 0;
  box-shadow:
    0 1px 0 rgba(255,255,255,.9) inset,
    0 4px 8px rgba(0,0,0,.08),
    0 16px 40px rgba(0,0,0,.18),
    0 40px 80px rgba(0,0,0,.12);
}

/* ── BACKGROUND SVG (replaces clip-path divs — renders correctly in html2canvas) ── */
.bg-svg {
  position: absolute; top: 0; left: 0;
  width: 760px; height: 460px; z-index: 1;
  pointer-events: none;
}

/* ── PHOTO ── */
.photo-wrap {
  position: absolute; top: 44px; left: 26px;
  width: 152px; height: 152px;
  border-radius: 50%; border: 4px solid #c9a84c;
  overflow: hidden; background: #c8cacd; z-index: 10;
  box-shadow: 0 4px 16px rgba(0,0,0,.3), 0 0 0 2px rgba(201,168,76,.25);
}
.photo-wrap img { width: 100%; height: 100%; object-fit: cover; object-position: top center; }

/* Staff ID pill */
.staff-pill {
  position: absolute; top: 210px; left: 26px;
  width: 152px; text-align: center; z-index: 10;
}
.staff-pill .lbl {
  font-size: 8px; font-weight: 700; color: rgba(255,255,255,.55);
  letter-spacing: .16em; display: block; margin-bottom: 3px;
}
.staff-pill .val {
  font-size: 18px; font-weight: 800; color: #c9a84c;
  letter-spacing: .04em; display: block;
}

/* ID chips */
.id-chips {
  display: flex; gap: 72px; padding: 8px 24px;
  border-top: 1px solid #edeae4; border-bottom: 1px solid #edeae4;
  flex-shrink: 0;
}
.id-chip { display: flex; flex-direction: column; gap: 1px; }
.id-chip .cl { font-size: 11px; color: #888; font-weight: 700; letter-spacing: .08em; }
.id-chip .cv { font-size: 13px; font-weight: 700; color: #1a2340; }

/* ── RIGHT CONTENT PANEL ── */
.right {
  position: absolute; top: 0; left: 244px; right: 0; bottom: 0;
  display: flex; flex-direction: column; z-index: 5;
}

/* Logos strip */
.logos-strip {
  height: 90px; display: flex; align-items: center;
  padding: 0 24px 0 44px; gap: 0;
  border-bottom: 1px solid #edeae4;
  position: relative; flex-shrink: 0;
}
.logos-strip::after {
  content: '';
  position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, #c9a84c, #f0d060 40%, #c9a84c 70%, rgba(201,168,76,.1));
}
.logo-img { object-fit: contain; display: block; }
.logo-sep {
  width: 1px; height: 58px;
  background: linear-gradient(180deg, transparent, rgba(201,168,76,.65), transparent);
  margin: 0 22px; flex-shrink: 0;
}

/* Name + position */
.content {
  flex: 1; padding: 20px 24px 0;
  position: relative; overflow: hidden;
}
.content::after {
  content: 'QPC';
  position: absolute; right: 12px; bottom: 60px;
  font-size: 72px; font-weight: 900; color: #7b1325; opacity: .025;
  line-height: 1; pointer-events: none;
}
.hex-pattern {
  position: absolute; right: 0; top: 0; width: 140px; height: 180px; opacity: .045;
  background-image: radial-gradient(circle, #7b1325 1px, transparent 1px);
  background-size: 14px 14px;
}
.eyebrow {
  font-size: 7.5px; font-weight: 700; color: #c9a84c;
  letter-spacing: .22em; margin-bottom: 12px; position: relative; z-index: 1;
}
.en-name {
  font-size: 28px; font-weight: 900; color: #1a2340;
  line-height: 1; letter-spacing: -.025em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  position: relative; z-index: 1; max-width: 100%;
}
.ar-name {
  font-size: 28px; font-weight: 900; color: #1a2340; margin-top: 4px;
  direction: rtl; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  position: relative; z-index: 1; line-height: 1.1; max-width: 100%;
}
.rule { display: flex; align-items: center; gap: 8px; margin: 12px 0; position: relative; z-index: 1; }
.rule-bar { height: 2.5px; width: 44px; background: #c9a84c; border-radius: 2px; flex-shrink: 0; }
.rule-line { height: 1px; flex: 1; background: #edeae4; }
.rule-dot { width: 10px; height: 10px; border-radius: 50%; background: #c9a84c; flex-shrink: 0; }
.pos-en {
  font-size: 24px; font-weight: 700; color: #7b1325;
  position: relative; z-index: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.pos-ar {
  font-size: 24px; font-weight: 700; color: #7b1325; margin-top: 4px;
  direction: rtl; text-align: left; position: relative; z-index: 1;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* Contact footer */
.contact { border-top: 1px solid #edeae4; padding: 12px 24px 16px; display: flex; gap: 20px; flex-shrink: 0; }
.contact-row { display: flex; align-items: center; gap: 10px; }
.contact-icon {
  width: 28px; height: 28px; border-radius: 50%; background: #7b1325;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.contact-icon svg { width: 14px; height: 14px; stroke: white; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.contact-text { font-size: 13px; color: #333; font-weight: 500; }

/* Bottom gold bar */
.gold-bar {
  position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
  background: linear-gradient(90deg, #7b1325, #c9a84c 25%, #f0d060 50%, #c9a84c 75%, #7b1325);
  z-index: 20;
}
</style>
</head>
<body>

<div class="btns">
  <button class="btn" id="dlBtn"    style="background:#7b1325;color:white">⬇ Download PNG</button>
  <button class="btn" id="printBtn" style="background:#2d3748;color:white">🖶 Print</button>
  <button class="btn"               style="background:white;color:#555;border:1px solid #ddd" onclick="window.close()">← Back</button>
</div>

<div class="card" id="card">

  <!--
    SVG background replaces clip-path divs.
    html2canvas does not support CSS clip-path reliably — the SVG approach
    renders the diagonal shapes correctly in both canvas export and print.
  -->
  <svg class="bg-svg" viewBox="0 0 760 460" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
    <defs>
      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#f0d060"/>
        <stop offset="50%"  stop-color="#c9a84c"/>
        <stop offset="100%" stop-color="#8b6500"/>
      </linearGradient>
      <pattern id="diagLines" x="0" y="0" width="14.14" height="14.14" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <rect x="0" y="0" width="1" height="14.14" fill="rgba(255,255,255,0.04)"/>
      </pattern>
      <clipPath id="bandClip">
        <polygon points="0,0 230,0 182,460 0,460"/>
      </clipPath>
    </defs>
    <!-- Crimson diagonal band -->
    <polygon points="0,0 230,0 182,460 0,460" fill="#7b1325"/>
    <!-- Diagonal texture overlay -->
    <rect x="0" y="0" width="760" height="460" fill="url(#diagLines)" clip-path="url(#bandClip)"/>
    <!-- Gold accent strip -->
    <polygon points="232,0 242,0 192,460 184,460" fill="url(#goldGrad)"/>
  </svg>

  <!-- Photo -->
  <div class="photo-wrap">
    ${photo
      ? `<img src="${photo}" crossorigin="anonymous" alt="${name}"/>`
      : `<svg viewBox="0 0 100 115" width="100%" height="100%" style="padding-top:8%">
           <circle cx="50" cy="34" r="25" fill="#9aa0a6"/>
           <ellipse cx="50" cy="97" rx="40" ry="28" fill="#9aa0a6"/>
         </svg>`
    }
  </div>

  <!-- Staff ID -->
  <div class="staff-pill">
    <span class="lbl">STAFF ID</span>
    <span class="val">${staffId}</span>
  </div>

  <!-- Right panel -->
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
      <div class="eyebrow">QATAR PARALYMPIC COMMITTEE  ·  بطاقة موظف</div>
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
      <div class="id-chip"><span class="cl">JOB ID</span><span class="cv">${jobId}</span></div>
      <div class="id-chip"><span class="cl">QSS NUMBER</span><span class="cv">${qssNum}</span></div>
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
  var CARD_W = 760, CARD_H = 460;
  var h2cLoaded = false, h2cLoading = false, h2cQueue = [];

  function loadH2C(cb) {
    if (h2cLoaded) { cb(); return; }
    h2cQueue.push(cb);
    if (h2cLoading) return;
    h2cLoading = true;
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onerror = function () { alert('Could not load html2canvas. Check internet connection.'); };
    s.onload = function () {
      h2cLoaded = true;
      h2cQueue.forEach(function (fn) { fn(); });
      h2cQueue = [];
    };
    document.head.appendChild(s);
  }

  function waitReady(cb) {
    var fontReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    var imgs = Array.from(document.querySelectorAll('#card img'));
    var imgReady = Promise.all(imgs.map(function (img) {
      if (img.complete) return Promise.resolve();
      return new Promise(function (res) { img.onload = res; img.onerror = res; });
    }));
    Promise.all([fontReady, imgReady]).then(cb);
  }

  function captureCard(cb) {
    loadH2C(function () {
      waitReady(function () {
        html2canvas(document.getElementById('card'), {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: CARD_W,
          height: CARD_H,
          x: 0, y: 0,
          scrollX: 0, scrollY: 0,
          windowWidth: CARD_W,
          windowHeight: CARD_H,
          logging: false,
          imageTimeout: 15000,
          onclone: function (doc) {
            doc.documentElement.style.overflow = 'hidden';
            doc.body.style.cssText = 'overflow:hidden;padding:0;margin:0;width:760px;height:460px;';
          }
        }).then(cb).catch(function (e) { alert('Capture error: ' + e.message); });
      });
    });
  }

  /* Download PNG */
  document.getElementById('dlBtn').onclick = function () {
    var btn = this;
    btn.textContent = 'Generating…'; btn.disabled = true;
    captureCard(function (canvas) {
      var a = document.createElement('a');
      a.download = '${safeName}-ID-Card.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
      btn.textContent = '⬇ Download PNG'; btn.disabled = false;
    });
  };

  /* Print — renders to canvas first, then prints the image.
     This bypasses all browser CSS print restrictions (Safari clip-path, color-adjust, etc.) */
  document.getElementById('printBtn').onclick = function () {
    var btn = this;
    btn.textContent = 'Preparing…'; btn.disabled = true;
    captureCard(function (canvas) {
      btn.textContent = '🖶 Print'; btn.disabled = false;
      var dataUrl = canvas.toDataURL('image/png');
      var pw = window.open('', '_blank');
      if (!pw) { alert('Popup blocked — allow popups for this site and try again.'); return; }
      pw.document.write(
        '<!DOCTYPE html><html><head>' +
        '<meta charset="UTF-8"/>' +
        '<style>' +
        '*{margin:0;padding:0;box-sizing:border-box}' +
        '@page{size:760px 460px;margin:0}' +
        'html,body{width:760px;height:460px;overflow:hidden;background:#fff}' +
        'img{width:760px;height:460px;display:block}' +
        '</style></head><body>' +
        '<img src="' + dataUrl + '"/>' +
        '<script>window.onload=function(){window.print();};<\\/script>' +
        '</body></html>'
      );
      pw.document.close();
    });
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
