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
const W=1536, H=1024;
const NAVY='#1a2340', CRIMSON='#7b1425', GOLD='#c9a84c', WHITE='#ffffff', DARK='#1c1c1c', GRAY='#606060';

function loadImg(src){
  return new Promise((res,rej)=>{
    const i=new Image(); i.crossOrigin='anonymous';
    i.onload=()=>res(i);
    i.onerror=(e)=>rej(new Error('Failed to load: '+src));
    i.src=src;
  });
}

function clipCircle(ctx,cx,cy,r){
  ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
}

// Fit font size so text stays within maxW
function fitFont(ctx, text, maxW, maxSize, weight, family){
  let size=maxSize;
  while(size>20){
    ctx.font=weight+' '+size+'px '+family;
    if(ctx.measureText(text).width<=maxW) break;
    size-=2;
  }
  return size;
}

async function draw(){
  const cv=document.getElementById('card');
  const ctx=cv.getContext('2d');

  // ── 1. BACKGROUND ────────────────────────────────────────────────────────
  const bg=await loadImg('/card-bg.png');
  ctx.drawImage(bg,0,0,W,H);

  // ── 2. LOGOS (transparent PNGs) ──────────────────────────────────────────
  const [qpc,qatar,so]=await Promise.all([
    loadImg('/logo-qpc.png'),
    loadImg('/logo-qatar.png'),
    loadImg('/logo-so.png'),
  ]);

  const LOGO_H=165, TOP=28;
  const qpcW=Math.round(qpc.width*LOGO_H/qpc.height);
  ctx.drawImage(qpc, 425, TOP, qpcW, LOGO_H);

  const d1x=425+qpcW+45;
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(d1x,TOP+12); ctx.lineTo(d1x,TOP+146); ctx.stroke();

  const qatarW=Math.round(qatar.width*LOGO_H/qatar.height);
  ctx.drawImage(qatar, d1x+34, TOP, qatarW, LOGO_H);

  const d2x=d1x+34+qatarW+45;
  ctx.beginPath(); ctx.moveTo(d2x,TOP+12); ctx.lineTo(d2x,TOP+146); ctx.stroke();

  // SO logo — keep it reasonable width
  const soH=80, soW=Math.min(Math.round(so.width*soH/so.height), 280);
  ctx.drawImage(so, d2x+34, TOP+(LOGO_H-soH)/2, soW, soH);

  // ── 3. PHOTO ─────────────────────────────────────────────────────────────
  const CX=248, CY=528, R=149;
  ctx.strokeStyle=GOLD; ctx.lineWidth=12;
  ctx.beginPath(); ctx.arc(CX,CY,R+12,0,Math.PI*2); ctx.stroke();

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

  // ── 4. NAME BLOCK ─────────────────────────────────────────────────────────
  const TX=418;          // left edge of text column
  const TEXT_MAX=1490-TX; // max width (stops before right edge)

  // EN Name — large bold, auto-fit
  const enName=${JSON.stringify(emp.name||'Full Name')};
  const enSize=fitFont(ctx,enName,TEXT_MAX,92,'900','Arial');
  ctx.font='900 '+enSize+'px Arial';
  ctx.fillStyle=NAVY;
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(enName, TX, 318);

  // AR Name — below EN name, left-aligned, RTL
  const arName=${JSON.stringify(emp.name_ar||'الاسم الكامل')};
  const arSize=fitFont(ctx,arName,TEXT_MAX,60,'bold','Arial');
  ctx.font='bold '+arSize+'px Arial';
  ctx.fillStyle=NAVY;
  ctx.direction='rtl';
  ctx.textAlign='right';
  ctx.textBaseline='top';
  // anchor at TX+TEXT_MAX so it flows rightward from left
  ctx.fillText(arName, TX+TEXT_MAX, 422);
  ctx.direction='ltr';

  // Gold separator line — fixed width under Arabic name, with dot at end
  const SEP_Y=505;
  const LINE_W=Math.min(ctx.measureText(arName).width+60, TEXT_MAX*0.75);
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(TX,SEP_Y); ctx.lineTo(TX+LINE_W,SEP_Y); ctx.stroke();
  ctx.fillStyle=GOLD;
  ctx.beginPath(); ctx.arc(TX+LINE_W,SEP_Y,16,0,Math.PI*2); ctx.fill();

  // Position EN
  const posEn=${JSON.stringify(emp.designation||'Position Name')};
  const posSize=fitFont(ctx,posEn,TEXT_MAX*0.7,58,'700','Arial');
  ctx.font='700 '+posSize+'px Arial';
  ctx.fillStyle=NAVY;
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(posEn, TX, 538);

  // Position AR — crimson, RTL
  const posAr=${JSON.stringify(desigAr||'المسمى الوظيفي')};
  const posArSize=fitFont(ctx,posAr,TEXT_MAX*0.7,48,'bold','Arial');
  ctx.font='bold '+posArSize+'px Arial';
  ctx.fillStyle=CRIMSON;
  ctx.direction='rtl'; ctx.textAlign='right'; ctx.textBaseline='top';
  ctx.fillText(posAr, TX+TEXT_MAX*0.7, 612);
  ctx.direction='ltr';

  // ── 5. ID STRIP ──────────────────────────────────────────────────────────
  const ICY=775, IR=44;
  const idCols=[
    {cx:195, label:'Staff ID',   val:${JSON.stringify(staffId||'—')}},
    {cx:630, label:'Job ID',     val:${JSON.stringify(jobId||'—')}},
    {cx:1065,label:'QSS Number', val:${JSON.stringify(qssNum||'—')}},
  ];

  idCols.forEach(({cx,label,val})=>{
    // Crimson circle
    ctx.fillStyle=CRIMSON;
    ctx.beginPath(); ctx.arc(cx,ICY,IR,0,Math.PI*2); ctx.fill();
    // Icon
    ctx.strokeStyle=WHITE; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
    drawIcon(ctx,cx,ICY,label);
    // Label (gray, small)
    ctx.font='28px Arial'; ctx.fillStyle=GRAY;
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(label, cx+IR+18, ICY-22);
    // Value (dark, bold)
    ctx.font='bold 34px Arial'; ctx.fillStyle=DARK;
    ctx.fillText(val, cx+IR+18, ICY+12);
  });

  // Dividers between ID items
  ctx.strokeStyle='rgba(180,180,180,0.8)'; ctx.lineWidth=2;
  [428, 862].forEach(vx=>{
    ctx.beginPath(); ctx.moveTo(vx,ICY-46); ctx.lineTo(vx,ICY+46); ctx.stroke();
  });

  // ── 6. FOOTER ────────────────────────────────────────────────────────────
  const FY=932, CR=36;

  // Phone icon circle
  drawFooterCircle(ctx, 192, FY, CR, 'phone');
  ctx.font='40px Arial'; ctx.fillStyle=WHITE;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(${JSON.stringify(phone)}, 192+CR+20, FY);

  // Footer divider
  ctx.strokeStyle='rgba(201,168,76,0.45)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(655,FY-30); ctx.lineTo(655,FY+30); ctx.stroke();

  // Email icon circle
  drawFooterCircle(ctx, 730, FY, CR, 'email');
  ctx.fillText(${JSON.stringify(email)}, 730+CR+20, FY);

  // ── Done ─────────────────────────────────────────────────────────────────
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
  ctx.beginPath(); ctx.arc(CX,CY-R*0.22,R*0.32,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(CX,CY+R*0.5,R*0.5,R*0.4,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawIcon(ctx,cx,cy,label){
  const w=22;
  if(label==='Staff ID'){
    ctx.strokeRect(cx-w,cy-w,w*2,w*2);
    [[cx-14,cy-9,cx+14,cy-9],[cx-14,cy+1,cx+5,cy+1],[cx-14,cy+10,cx+2,cy+10]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    });
  } else if(label==='Job ID'){
    ctx.strokeRect(cx-w,cy-6,w*2,w+6);
    ctx.beginPath(); ctx.arc(cx,cy-10,10,Math.PI,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy+2); ctx.lineTo(cx,cy+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-10,cy+8); ctx.lineTo(cx+10,cy+8); ctx.stroke();
  } else {
    ctx.strokeRect(cx-w+2,cy-w+2,w*2-4,w*2-4);
    [-9,1,10].forEach(dy=>{
      ctx.beginPath(); ctx.moveTo(cx-13,cy+dy); ctx.lineTo(cx+13,cy+dy); ctx.stroke();
    });
  }
}

function drawFooterCircle(ctx,cx,cy,r,type){
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle=GOLD; ctx.lineWidth=2.5; ctx.lineCap='round';
  if(type==='phone'){
    // Phone handset shape
    ctx.beginPath();
    ctx.arc(cx-6,cy-6,10,Math.PI*1.1,Math.PI*1.9,false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx+6,cy+6,10,Math.PI*0.1,Math.PI*0.9,false);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-14,cy-8); ctx.lineTo(cx-10,cy-14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+10,cy+14); ctx.lineTo(cx+14,cy+8); ctx.stroke();
  } else {
    // Envelope
    ctx.strokeRect(cx-20,cy-13,40,26);
    ctx.beginPath(); ctx.moveTo(cx-20,cy-13); ctx.lineTo(cx,cy+4); ctx.lineTo(cx+20,cy-13); ctx.stroke();
  }
}

draw().catch(e=>{
  document.getElementById('btns').style.opacity='1';
  document.body.insertAdjacentHTML('beforeend','<div style="color:#f87171;margin-top:20px;font-size:14px">Error: '+e.message+'</div>');
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
      style={{
        borderColor: '#7a1325',
        color: '#7a1325',
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#f9e5ea' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}
    >
      <i className="ti ti-id-badge" style={{ fontSize: 14 }} />
      <span>{ar ? 'بطاقة الموظف' : 'ID Card'}</span>
    </button>
  )
}
