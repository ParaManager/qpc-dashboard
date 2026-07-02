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
  const staffId = emp.employee_number ? 'QPC-' + emp.employee_number : ''
  const jobId   = emp.job_id || ''
  const qssNum  = emp.qss_number ? 'QSS-' + emp.qss_number : ''
  const phone   = emp.phone || '+974 44040200'
  const email   = emp.email || 'info@qpc.qa'
  const photo   = emp.photo_url || ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ID Card – ${emp.name || ''}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#555;display:flex;flex-direction:column;align-items:center;
       justify-content:center;min-height:100vh;padding:28px;gap:18px;font-family:Arial,sans-serif}
  .btns{display:flex;gap:10px}
  .btn{padding:9px 22px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600}
  canvas{border-radius:20px;box-shadow:0 16px 64px rgba(0,0,0,.5);max-width:100%;display:block}
  @media print{
    body{background:white;padding:0;justify-content:flex-start}
    .btns{display:none!important}
    canvas{box-shadow:none;width:100%}
    @page{size:landscape;margin:0}
  }
</style>
</head>
<body>
<div class="btns" id="btns" style="opacity:0.3">
  <button class="btn" id="dlBtn" style="background:#7a1325;color:white">⬇ Download PNG</button>
  <button class="btn" onclick="window.print()" style="background:#2d3748;color:white">🖨 Print</button>
  <button class="btn" onclick="window.close()" style="background:white;color:#555;border:1px solid #ddd">← Back</button>
</div>
<canvas id="card" width="1536" height="1024"></canvas>

<script>
// Coordinates pixel-measured from reference image (1536×1024)
const W=1536, H=1024;
const NAVY='#1a2340', CRIMSON='#7b1425', GOLD='#c9a84c', WHITE='#ffffff', DARK='#1c1c1c', GRAY='#5a5a5a';

// Key positions from reference
const TX=634;           // left edge of all text
const NAME_Y=357;       // EN name top
const AR_NAME_Y=438;    // Arabic name top
const GOLD_Y=503;       // gold separator line Y
const GOLD_X2=1076;     // gold line right end
const DOT_X=1092;       // gold dot center
const DOT_R=18;
const POS_EN_Y=550;     // Position EN top
const POS_AR_Y=705;     // Position AR top (crimson)
const PHOTO_CX=288;     // photo circle center X
const PHOTO_CY=514;     // photo circle center Y
const PHOTO_R=259;      // photo inner radius
const GOLD_RING=12;     // gold ring width
const ID_CY=839;        // ID icon strip center Y
const ID_IR=46;         // ID icon radius
const FT_Y=913;         // footer center Y
const FT_CR=38;         // footer circle radius

function loadImg(src){
  return new Promise((res,rej)=>{
    const i=new Image(); i.crossOrigin='anonymous';
    i.onload=()=>res(i);
    i.onerror=()=>rej(new Error('Cannot load: '+src));
    i.src=src;
  });
}

function fitFont(ctx,text,maxW,maxSize,weight,family){
  let size=maxSize;
  while(size>18){
    ctx.font=weight+' '+size+'px '+family;
    if(ctx.measureText(text).width<=maxW) break;
    size-=2;
  }
  return size;
}

function clipCircle(ctx,cx,cy,r){
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
}

async function draw(){
  const cv=document.getElementById('card');
  const ctx=cv.getContext('2d');

  // ── 1. BACKGROUND ──────────────────────────────────────────────────────────
  const bg=await loadImg('/card-bg.png');
  ctx.drawImage(bg,0,0,W,H);

  // ── 2. LOGOS ───────────────────────────────────────────────────────────────
  // From reference: logos start around x=554 (QPC shield center≈615)
  // Layout: [QPC shield + text] | [Qatar shield] | [SO icon + text]
  const [qpc,qatar,so]=await Promise.all([
    loadImg('/logo-qpc.png'),
    loadImg('/logo-qatar.png'),
    loadImg('/logo-so.png'),
  ]);

  const LOGO_H=200;  // height of QPC+Qatar shields (tall)
  const LOGO_TOP=18;

  // QPC logo — shield only, draw at left
  const qpcW=Math.round(qpc.width*LOGO_H/qpc.height);
  const QPC_X=554;
  ctx.drawImage(qpc, QPC_X, LOGO_TOP, qpcW, LOGO_H);

  // "Qatar Paralympic Committee" text next to QPC logo (matching reference)
  const QPC_TEXT_X = QPC_X + qpcW + 14;
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillStyle=CRIMSON; ctx.font='bold 32px Arial';
  ctx.fillText('Qatar', QPC_TEXT_X, LOGO_TOP+30);
  ctx.fillText('Paralympic', QPC_TEXT_X, LOGO_TOP+68);
  ctx.fillText('Committee', QPC_TEXT_X, LOGO_TOP+106);
  ctx.font='22px Arial';
  ctx.fillText('اللجنة البارالمبية القطرية', QPC_TEXT_X, LOGO_TOP+148);

  // Divider 1
  const TEXT_RIGHT_1 = QPC_TEXT_X + 180;
  const D1X = TEXT_RIGHT_1 + 28;
  ctx.strokeStyle=GOLD; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(D1X,LOGO_TOP+12); ctx.lineTo(D1X,LOGO_TOP+180); ctx.stroke();

  // Qatar logo
  const qatarH=180;
  const qatarW=Math.round(qatar.width*qatarH/qatar.height);
  const QT_X = D1X + 28;
  ctx.drawImage(qatar, QT_X, LOGO_TOP+(LOGO_H-qatarH)/2, qatarW, qatarH);

  // Divider 2
  const D2X = QT_X + qatarW + 28;
  ctx.beginPath(); ctx.moveTo(D2X,LOGO_TOP+12); ctx.lineTo(D2X,LOGO_TOP+180); ctx.stroke();

  // SO logo — icon + text combo, keep reasonable size
  const soH=100;
  const soW=Math.round(so.width*soH/so.height);
  const SO_X = D2X + 28;
  ctx.drawImage(so, SO_X, LOGO_TOP+(LOGO_H-soH)/2, soW, soH);

  // Arabic text under SO
  ctx.font='22px Arial'; ctx.fillStyle='#555';
  ctx.fillText('الأولمبياد الخاص', SO_X, LOGO_TOP+soH+(LOGO_H-soH)/2+8);
  ctx.fillText('قطر', SO_X+20, LOGO_TOP+soH+(LOGO_H-soH)/2+34);

  // ── 3. PHOTO CIRCLE ────────────────────────────────────────────────────────
  // Gold ring
  ctx.strokeStyle=GOLD; ctx.lineWidth=GOLD_RING*2;
  ctx.beginPath(); ctx.arc(PHOTO_CX,PHOTO_CY,PHOTO_R+GOLD_RING,0,Math.PI*2); ctx.stroke();

  if(${JSON.stringify(!!photo)}){
    try{
      const ph=await loadImg(${JSON.stringify(photo)});
      const side=Math.min(ph.width,ph.height);
      const sx=(ph.width-side)/2;
      const sy=Math.max(0,(ph.height-side)*0.12);
      clipCircle(ctx,PHOTO_CX,PHOTO_CY,PHOTO_R);
      ctx.drawImage(ph,sx,sy,side,side,PHOTO_CX-PHOTO_R,PHOTO_CY-PHOTO_R,PHOTO_R*2,PHOTO_R*2);
      ctx.restore();
    } catch(e){ drawPlaceholder(ctx,PHOTO_CX,PHOTO_CY,PHOTO_R); }
  } else { drawPlaceholder(ctx,PHOTO_CX,PHOTO_CY,PHOTO_R); }

  // ── 4. NAME BLOCK ──────────────────────────────────────────────────────────
  const MAX_W = 1460 - TX;  // right boundary = 1460

  // EN Name — large bold left-aligned
  const enName=${JSON.stringify(emp.name||'Full Name')};
  const enSize=fitFont(ctx,enName,MAX_W,88,'900','Arial');
  ctx.font='900 '+enSize+'px Arial';
  ctx.fillStyle=NAVY; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(enName, TX, NAME_Y);

  // Arabic Name — left-aligned at TX (same column)
  const arName=${JSON.stringify(emp.name_ar||'الاسم الكامل')};
  const arSize=fitFont(ctx,arName,MAX_W,58,'bold','Arial');
  ctx.font='bold '+arSize+'px Arial';
  ctx.fillStyle=NAVY; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(arName, TX, AR_NAME_Y);

  // Gold separator line
  ctx.strokeStyle=GOLD; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.moveTo(TX,GOLD_Y); ctx.lineTo(GOLD_X2,GOLD_Y); ctx.stroke();
  ctx.fillStyle=GOLD;
  ctx.beginPath(); ctx.arc(DOT_X,GOLD_Y,DOT_R,0,Math.PI*2); ctx.fill();

  // Position EN — bold dark navy
  const posEn=${JSON.stringify(emp.designation||'Position Name')};
  const posSize=fitFont(ctx,posEn,MAX_W*0.72,58,'bold','Arial');
  ctx.font='bold '+posSize+'px Arial';
  ctx.fillStyle=NAVY; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(posEn, TX, POS_EN_Y);

  // Position AR — crimson left-aligned
  const posAr=${JSON.stringify(desigAr||'المسمى الوظيفي')};
  const posArSize=fitFont(ctx,posAr,MAX_W*0.72,48,'bold','Arial');
  ctx.font='bold '+posArSize+'px Arial';
  ctx.fillStyle=CRIMSON; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(posAr, TX, POS_AR_Y);

  // ── 5. ID STRIP ────────────────────────────────────────────────────────────
  // Icon centers from reference: x=216, 646, 1178; CY=839; radius=46
  const idCols=[
    {cx:216,  label:'Staff ID',   val:${JSON.stringify(staffId||'—')}},
    {cx:646,  label:'Job ID',     val:${JSON.stringify(jobId||'—')}},
    {cx:1178, label:'QSS Number', val:${JSON.stringify(qssNum||'—')}},
  ];

  idCols.forEach(({cx,label,val})=>{
    ctx.fillStyle=CRIMSON;
    ctx.beginPath(); ctx.arc(cx,ID_CY,ID_IR,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=WHITE; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round';
    drawIDIcon(ctx,cx,ID_CY,label);
    const tx2=cx+ID_IR+16;
    ctx.font='28px Arial'; ctx.fillStyle=GRAY;
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(label, tx2, ID_CY-22);
    ctx.font='bold 34px Arial'; ctx.fillStyle=DARK;
    ctx.fillText(val, tx2, ID_CY+10);
  });

  // Dividers
  ctx.strokeStyle='rgba(165,165,165,0.7)'; ctx.lineWidth=2;
  [434, 866].forEach(vx=>{
    ctx.beginPath(); ctx.moveTo(vx,ID_CY-44); ctx.lineTo(vx,ID_CY+44); ctx.stroke();
  });

  // ── 6. FOOTER ──────────────────────────────────────────────────────────────
  // Circles at x=215, 583; Y=913
  drawFooterCircle(ctx,215,FT_Y,FT_CR,'phone');
  ctx.font='40px Arial'; ctx.fillStyle=WHITE;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(${JSON.stringify(phone)}, 215+FT_CR+18, FT_Y);

  ctx.strokeStyle='rgba(201,168,76,0.4)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(680,FT_Y-30); ctx.lineTo(680,FT_Y+30); ctx.stroke();

  drawFooterCircle(ctx,583,FT_Y,FT_CR,'email');
  ctx.fillText(${JSON.stringify(email)}, 583+FT_CR+18, FT_Y);

  // ── Done ───────────────────────────────────────────────────────────────────
  document.getElementById('btns').style.opacity='1';
  document.getElementById('dlBtn').onclick=()=>{
    const a=document.createElement('a');
    a.download=${JSON.stringify('ID-Card-'+(emp.name||'employee').replace(/\\s+/g,'-')+'.png')};
    a.href=cv.toDataURL('image/png');
    a.click();
  };
}

function drawPlaceholder(ctx,cx,cy,r){
  clipCircle(ctx,cx,cy,r);
  ctx.fillStyle='#c8cacd'; ctx.fillRect(cx-r,cy-r,r*2,r*2);
  ctx.fillStyle='#96999e';
  ctx.beginPath(); ctx.arc(cx,cy-r*0.22,r*0.33,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx,cy+r*0.5,r*0.52,r*0.42,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawIDIcon(ctx,cx,cy,label){
  const w=24;
  if(label==='Staff ID'){
    ctx.strokeRect(cx-w,cy-w,w*2,w*2);
    [[cx-14,cy-9,cx+14,cy-9],[cx-14,cy+1,cx+6,cy+1],[cx-14,cy+10,cx+3,cy+10]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
  } else if(label==='Job ID'){
    ctx.strokeRect(cx-w,cy-5,w*2,w+5);
    ctx.beginPath(); ctx.arc(cx,cy-10,11,Math.PI,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy+3); ctx.lineTo(cx,cy+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-11,cy+9); ctx.lineTo(cx+11,cy+9); ctx.stroke();
  } else {
    ctx.strokeRect(cx-w+2,cy-w+2,(w-2)*2,(w-2)*2);
    [-10,1,11].forEach(dy=>{
      ctx.beginPath(); ctx.moveTo(cx-13,cy+dy); ctx.lineTo(cx+13,cy+dy); ctx.stroke();
    });
  }
}

function drawFooterCircle(ctx,cx,cy,r,type){
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=GOLD; ctx.lineWidth=2.5; ctx.lineCap='round';
  if(type==='phone'){
    // Phone handset matching reference
    ctx.beginPath();
    ctx.moveTo(cx-12,cy+16); ctx.quadraticCurveTo(cx-16,cy+8,cx-14,cy-2);
    ctx.quadraticCurveTo(cx-12,cy-10,cx-6,cy-14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx+6,cy+14); ctx.quadraticCurveTo(cx+14,cy+10,cx+15,cy+2);
    ctx.quadraticCurveTo(cx+16,cy-6,cx+12,cy-16);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-12,cy+16); ctx.lineTo(cx-6,cy+22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+12,cy-16); ctx.lineTo(cx+18,cy-10); ctx.stroke();
  } else {
    // Envelope
    ctx.strokeRect(cx-20,cy-13,40,26);
    ctx.beginPath(); ctx.moveTo(cx-20,cy-13); ctx.lineTo(cx,cy+4); ctx.lineTo(cx+20,cy-13); ctx.stroke();
  }
}

draw().catch(e=>{
  document.getElementById('btns').style.opacity='1';
  document.body.insertAdjacentHTML('beforeend',
    '<div style="color:#f87171;margin-top:20px;font-size:14px;background:#333;padding:12px;border-radius:8px">Error: '+e.message+'</div>');
});
</script>
</body></html>`

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
      style={{ borderColor:'#7a1325', color:'#7a1325', padding:'5px 12px', display:'flex', alignItems:'center', gap:6 }}
      onMouseEnter={e => { e.currentTarget.style.background='#f9e5ea' }}
      onMouseLeave={e => { e.currentTarget.style.background='' }}
    >
      <i className="ti ti-id-badge" style={{ fontSize:14 }} />
      <span>{ar ? 'بطاقة الموظف' : 'ID Card'}</span>
    </button>
  )
}
