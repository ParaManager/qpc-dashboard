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
// All coordinates calibrated from pixel-measurement of the reference card (1536×1024)
const W=1536, H=1024;
const NAVY='#1a2340', CRIMSON='#7b1425', GOLD='#c9a84c', WHITE='#ffffff', DARK='#1c1c1c', GRAY='#606060';

// Exact positions from reference
const TX=625;          // left edge of all text & gold line
const GOLD_LINE_Y=497; // gold separator line Y
const GOLD_LINE_X2=1074; // gold line right end
const GOLD_DOT_X=1090;   // gold dot center X
const DOT_R=18;

const NAME_Y=352;      // EN name baseline area
const AR_NAME_Y=420;   // Arabic name top
const POS_EN_Y=530;    // Position EN top
const POS_AR_Y=634;    // Position AR top
const ID_CY=768;       // ID icons center Y
const ID_IR=46;        // ID icon radius
const FT_Y=921;        // Footer row center Y
const FT_CR=38;        // Footer circle radius

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
  while(size>20){
    ctx.font=weight+' '+size+'px '+family;
    if(ctx.measureText(text).width<=maxW) break;
    size-=2;
  }
  return size;
}

function clipCircle(ctx,cx,cy,r){
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
}

async function draw(){
  const cv=document.getElementById('card');
  const ctx=cv.getContext('2d');

  // ── 1. BACKGROUND ──────────────────────────────────────────────────────────
  const bg=await loadImg('/card-bg.png');
  ctx.drawImage(bg,0,0,W,H);

  // ── 2. LOGOS ───────────────────────────────────────────────────────────────
  // From reference: QPC logo x=295-451, y=22-76 (logo area top=22)
  // Logo zone: starts at x≈300, height≈200px
  const [qpc,qatar,so]=await Promise.all([
    loadImg('/logo-qpc.png'),
    loadImg('/logo-qatar.png'),
    loadImg('/logo-so.png'),
  ]);

  const LOGO_H=178;
  const LOGO_TOP=22;
  const LOGO_START_X=300;

  // QPC logo
  const qpcW=Math.round(qpc.width*LOGO_H/qpc.height);
  ctx.drawImage(qpc, LOGO_START_X, LOGO_TOP, qpcW, LOGO_H);

  // Divider 1 after QPC
  const d1x=LOGO_START_X+qpcW+40;
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(d1x,LOGO_TOP+15); ctx.lineTo(d1x,LOGO_TOP+158); ctx.stroke();

  // Qatar logo
  const qatarW=Math.round(qatar.width*LOGO_H/qatar.height);
  ctx.drawImage(qatar, d1x+30, LOGO_TOP, qatarW, LOGO_H);

  // Divider 2 after Qatar
  const d2x=d1x+30+qatarW+40;
  ctx.beginPath(); ctx.moveTo(d2x,LOGO_TOP+15); ctx.lineTo(d2x,LOGO_TOP+158); ctx.stroke();

  // SO logo — reference shows it smaller height
  const soH=90;
  const soW=Math.round(so.width*soH/so.height);
  ctx.drawImage(so, d2x+30, LOGO_TOP+(LOGO_H-soH)/2, soW, soH);

  // ── 3. PHOTO ───────────────────────────────────────────────────────────────
  // Reference: center=(307,539), radius≈195 (measured from reference pixels)
  const CX=307, CY=539, R=195;

  // Gold ring
  ctx.strokeStyle=GOLD; ctx.lineWidth=14;
  ctx.beginPath(); ctx.arc(CX,CY,R+14,0,Math.PI*2); ctx.stroke();

  if(${JSON.stringify(!!photo)}){
    try{
      const ph=await loadImg(${JSON.stringify(photo)});
      const side=Math.min(ph.width,ph.height);
      const sx=(ph.width-side)/2;
      const sy=Math.max(0,(ph.height-side)*0.15);
      clipCircle(ctx,CX,CY,R);
      ctx.drawImage(ph,sx,sy,side,side,CX-R,CY-R,R*2,R*2);
      ctx.restore();
    } catch(e){ drawPlaceholder(ctx,CX,CY,R); }
  } else { drawPlaceholder(ctx,CX,CY,R); }

  // ── 4. NAME BLOCK ──────────────────────────────────────────────────────────
  // All text starts at TX=625, left-aligned
  const TEXT_RIGHT=1450; // right boundary (don't overlap the watermark figure)
  const MAX_W=TEXT_RIGHT-TX;

  // EN Name — bold, large, left-aligned
  ctx.textBaseline='top'; ctx.textAlign='left';
  const enName=${JSON.stringify(emp.name||'Full Name')};
  const enSize=fitFont(ctx,enName,MAX_W,90,'900','Arial');
  ctx.font='900 '+enSize+'px Arial';
  ctx.fillStyle=NAVY;
  ctx.fillText(enName, TX, NAME_Y);

  // Arabic Name — LEFT-ALIGNED (same TX), but text direction RTL
  // Render Arabic left-to-right visually starting at TX
  const arName=${JSON.stringify(emp.name_ar||'الاسم الكامل')};
  const arSize=fitFont(ctx,arName,MAX_W,62,'bold','Arial');
  ctx.font='bold '+arSize+'px Arial';
  ctx.fillStyle=NAVY;
  ctx.textAlign='left'; ctx.direction='ltr';
  // For Arabic we anchor to left and let it flow — since Arabic reshaping
  // happened server-side, we render as-is
  ctx.fillText(arName, TX, AR_NAME_Y);

  // Gold separator line — from TX to GOLD_LINE_X2, with dot at end
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(TX,GOLD_LINE_Y); ctx.lineTo(GOLD_LINE_X2,GOLD_LINE_Y); ctx.stroke();
  ctx.fillStyle=GOLD;
  ctx.beginPath(); ctx.arc(GOLD_DOT_X,GOLD_LINE_Y,DOT_R,0,Math.PI*2); ctx.fill();

  // Position EN — bold, left-aligned
  const posEn=${JSON.stringify(emp.designation||'Position Name')};
  const posSize=fitFont(ctx,posEn,MAX_W*0.75,60,'700','Arial');
  ctx.font='700 '+posSize+'px Arial';
  ctx.fillStyle=NAVY; ctx.textAlign='left';
  ctx.fillText(posEn, TX, POS_EN_Y);

  // Position AR — crimson, left-aligned
  const posAr=${JSON.stringify(desigAr||'المسمى الوظيفي')};
  const posArSize=fitFont(ctx,posAr,MAX_W*0.75,52,'bold','Arial');
  ctx.font='bold '+posArSize+'px Arial';
  ctx.fillStyle=CRIMSON; ctx.textAlign='left'; ctx.direction='ltr';
  ctx.fillText(posAr, TX, POS_AR_Y);
  ctx.direction='ltr';

  // ── 5. ID STRIP ────────────────────────────────────────────────────────────
  // Reference: icon centers at x=221, 650, 1193; center Y=768
  const idCols=[
    {cx:221,  label:'Staff ID',   val:${JSON.stringify(staffId||'—')}},
    {cx:650,  label:'Job ID',     val:${JSON.stringify(jobId||'—')}},
    {cx:1193, label:'QSS Number', val:${JSON.stringify(qssNum||'—')}},
  ];

  idCols.forEach(({cx,label,val})=>{
    // Crimson circle
    ctx.fillStyle=CRIMSON;
    ctx.beginPath(); ctx.arc(cx,ID_CY,ID_IR,0,Math.PI*2); ctx.fill();
    // Icon (white)
    ctx.strokeStyle=WHITE; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
    drawIDIcon(ctx,cx,ID_CY,label);
    // Label
    ctx.font='30px Arial'; ctx.fillStyle=GRAY;
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(label, cx+ID_IR+16, ID_CY-22);
    // Value
    ctx.font='bold 36px Arial'; ctx.fillStyle=DARK;
    ctx.fillText(val, cx+ID_IR+16, ID_CY+10);
  });

  // Vertical dividers between ID items (thin gray)
  ctx.strokeStyle='rgba(170,170,170,0.8)'; ctx.lineWidth=2;
  [440, 880].forEach(vx=>{
    ctx.beginPath(); ctx.moveTo(vx,ID_CY-46); ctx.lineTo(vx,ID_CY+46); ctx.stroke();
  });

  // ── 6. FOOTER ──────────────────────────────────────────────────────────────
  // Reference: circles at x=156, x=544; center Y=921
  // Phone circle
  drawFooterCircle(ctx,156,FT_Y,FT_CR,'phone');
  ctx.font='42px Arial'; ctx.fillStyle=WHITE;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(${JSON.stringify(phone)}, 156+FT_CR+18, FT_Y);

  // Footer divider
  ctx.strokeStyle='rgba(201,168,76,0.4)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(620,FT_Y-32); ctx.lineTo(620,FT_Y+32); ctx.stroke();

  // Email circle
  drawFooterCircle(ctx,544,FT_Y,FT_CR,'email');  // wait — ref shows email at x≈544? let me check
  ctx.fillText(${JSON.stringify(email)}, 544+FT_CR+18, FT_Y);

  // ── Done ───────────────────────────────────────────────────────────────────
  document.getElementById('btns').style.opacity='1';
  document.getElementById('dlBtn').onclick=()=>{
    const a=document.createElement('a');
    a.download=${JSON.stringify('ID-Card-'+(emp.name||'employee').replace(/\\s+/g,'-')+'.png')};
    a.href=cv.toDataURL('image/png');
    a.click();
  };
}

function drawPlaceholder(ctx,CX,CY,R){
  clipCircle(ctx,CX,CY,R);
  ctx.fillStyle='#c8cacd';
  ctx.fillRect(CX-R,CY-R,R*2,R*2);
  ctx.fillStyle='#96999e';
  ctx.beginPath(); ctx.arc(CX,CY-R*0.22,R*0.33,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(CX,CY+R*0.5,R*0.52,R*0.42,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawIDIcon(ctx,cx,cy,label){
  const w=24;
  if(label==='Staff ID'){
    ctx.strokeRect(cx-w,cy-w,w*2,w*2);
    [[cx-15,cy-10,cx+15,cy-10],[cx-15,cy,cx+8,cy],[cx-15,cy+10,cx+4,cy+10]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
  } else if(label==='Job ID'){
    ctx.strokeRect(cx-w,cy-6,w*2,w+6);
    ctx.beginPath(); ctx.arc(cx,cy-11,11,Math.PI,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy+2); ctx.lineTo(cx,cy+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-11,cy+8); ctx.lineTo(cx+11,cy+8); ctx.stroke();
  } else {
    ctx.strokeRect(cx-w+2,cy-w+2,(w-2)*2,(w-2)*2);
    [-10,1,11].forEach(dy=>{
      ctx.beginPath(); ctx.moveTo(cx-14,cy+dy); ctx.lineTo(cx+14,cy+dy); ctx.stroke();
    });
  }
}

function drawFooterCircle(ctx,cx,cy,r,type){
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=GOLD; ctx.lineWidth=2.5; ctx.lineCap='round';
  if(type==='phone'){
    // Phone handset
    ctx.beginPath();
    ctx.moveTo(cx-14,cy-16); ctx.lineTo(cx-14,cy-8);
    ctx.arc(cx,cy,14,Math.PI,0,false);
    ctx.lineTo(cx+14,cy-16);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-14,cy+8); ctx.lineTo(cx-14,cy+16);
    ctx.arc(cx,cy,14,Math.PI,Math.PI*2,true);
    ctx.lineTo(cx+14,cy+8); ctx.stroke();
    // actual phone shape
    ctx.beginPath();
    ctx.moveTo(cx-14,cy+16); ctx.lineTo(cx-10,cy+20);
    ctx.arc(cx-4,cy+17,8,Math.PI*0.6,Math.PI*1.4,false); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx+10,cy-20); ctx.lineTo(cx+14,cy-16);
    ctx.arc(cx+4,cy-17,8,Math.PI*1.6,Math.PI*0.4,false); ctx.stroke();
  } else {
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
