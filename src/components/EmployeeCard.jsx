import { useLang } from '../lib/LangContext.jsx'

const DESIGNATION_AR = {
  'Coach':'مدرب','Assistant Coach':'مدرب مساعد','Technical Expert':'خبير تقني',
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
  const empName = emp.name || 'Full Name'
  const nameAr  = emp.name_ar || 'الاسم الكامل'
  const posEn   = emp.designation || 'Position Name'
  const posAr   = desigAr || 'المسمى الوظيفي'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ID Card – ${empName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#555;display:flex;flex-direction:column;align-items:center;
       justify-content:center;min-height:100vh;padding:28px;gap:18px;
       font-family:Arial,sans-serif}
  .no-print{display:flex;gap:10px}
  .btn{padding:9px 22px;border:none;border-radius:8px;cursor:pointer;
       font-size:13px;font-weight:600;font-family:inherit}
  canvas{border-radius:20px;box-shadow:0 16px 64px rgba(0,0,0,.5);
         max-width:100%;display:block}
  @media print{
    body{background:white;padding:0;justify-content:flex-start}
    .no-print{display:none!important}
    canvas{box-shadow:none;max-width:100%;width:100%}
    @page{size:landscape;margin:0}
  }
</style>
</head>
<body>
<div class="no-print" id="btns">
  <button class="btn" id="dlBtn" style="background:#7a1325;color:white">⬇ Download PNG</button>
  <button class="btn" onclick="window.print()" style="background:#2d3748;color:white">🖨 Print</button>
  <button class="btn" onclick="window.close()" style="background:white;color:#555;border:1px solid #ddd">← Back</button>
</div>
<canvas id="card" width="1536" height="1024"></canvas>

<script>
const W=1536, H=1024;
const NAVY='#1a2340', CRIMSON='#7b1425', GOLD='#c9a84c', WHITE='#ffffff',
      DARK='#1c1c1c', GRAY='#555555';

function loadImg(src){
  return new Promise((res,rej)=>{
    const i=new Image(); i.crossOrigin='anonymous';
    i.onload=()=>res(i); i.onerror=rej; i.src=src;
  })
}

function clipCircle(ctx, cx, cy, r){
  ctx.save(); ctx.beginPath();
  ctx.arc(cx,cy,r,0,Math.PI*2); ctx.clip();
}

function drawTextLines(ctx, lines, x, y, lineH){
  lines.forEach((l,i)=>ctx.fillText(l, x, y+i*lineH))
}

// Fit text to max width
function fitText(ctx, text, maxW, baseSize, fontStr){
  let size=baseSize;
  while(size>18){
    ctx.font=fontStr.replace('{S}',size);
    if(ctx.measureText(text).width<=maxW) break;
    size-=2;
  }
  return size;
}

async function draw(){
  const cv=document.getElementById('card');
  const ctx=cv.getContext('2d');

  // 1. Background
  const bg=await loadImg('/card-bg.jpg');
  ctx.drawImage(bg,0,0,W,H);

  // 2. Logos
  const [qpc,qatar,so]=await Promise.all([
    loadImg('/logo-qpc.jpg'),
    loadImg('/logo-qatar.jpg'),
    loadImg('/logo-so.jpg'),
  ]);

  const LOGO_H=165, TOP=28;
  // QPC
  const qpcW=Math.round(qpc.width*LOGO_H/qpc.height);
  ctx.drawImage(qpc, 425, TOP, qpcW, LOGO_H);
  // Gold divider 1
  const d1x=425+qpcW+42;
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(d1x,TOP+10); ctx.lineTo(d1x,TOP+148); ctx.stroke();
  // Qatar
  const qatarW=Math.round(qatar.width*LOGO_H/qatar.height);
  ctx.drawImage(qatar, d1x+32, TOP, qatarW, LOGO_H);
  // Gold divider 2
  const d2x=d1x+32+qatarW+42;
  ctx.beginPath(); ctx.moveTo(d2x,TOP+10); ctx.lineTo(d2x,TOP+148); ctx.stroke();
  // Special Olympics
  const soH=75, soW=Math.round(so.width*soH/so.height);
  ctx.drawImage(so, d2x+32, TOP+(LOGO_H-soH)/2, soW, soH);

  // 3. Photo circle (gold ring + photo/placeholder)
  const CX=248, CY=528, R=149;
  // Gold ring
  ctx.strokeStyle=GOLD; ctx.lineWidth=12;
  ctx.beginPath(); ctx.arc(CX,CY,R+12,0,Math.PI*2); ctx.stroke();
  // Photo or placeholder
  if(${JSON.stringify(!!photo)}){
    try{
      const ph=await loadImg(${JSON.stringify(photo)});
      const side=Math.min(ph.width,ph.height);
      const sx=(ph.width-side)/2, sy=Math.max(0,(ph.height-side)/4);
      clipCircle(ctx,CX,CY,R);
      ctx.drawImage(ph,sx,sy,side,side,CX-R,CY-R,R*2,R*2);
      ctx.restore();
    }catch(e){drawPlaceholder(ctx,CX,CY,R)}
  } else { drawPlaceholder(ctx,CX,CY,R) }

  // 4. Name block
  const TX=418, TEXT_MAX=1470-TX;

  // EN name
  let enSize=fitText(ctx,${JSON.stringify(empName)},TEXT_MAX,88,'{S}px 900 Arial');
  ctx.font=enSize+'px 900 Arial';
  ctx.fillStyle=NAVY;
  ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(${JSON.stringify(empName)}, TX, 318);

  // AR name
  let arSize=fitText(ctx,${JSON.stringify(nameAr)},TEXT_MAX,60,'bold {S}px Arial');
  ctx.font='bold '+arSize+'px Arial';
  ctx.fillStyle=NAVY; ctx.direction='rtl'; ctx.textAlign='right';
  ctx.fillText(${JSON.stringify(nameAr)}, TX+TEXT_MAX, 420);
  ctx.direction='ltr';

  // Gold separator
  const SEP_Y=506;
  const arBB=ctx.measureText(${JSON.stringify(nameAr)});
  const lineEnd=TX+Math.min(arBB.width+50, TEXT_MAX);
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(TX,SEP_Y); ctx.lineTo(lineEnd,SEP_Y); ctx.stroke();
  ctx.fillStyle=GOLD;
  ctx.beginPath(); ctx.arc(lineEnd,SEP_Y,15,0,Math.PI*2); ctx.fill();

  // Position EN
  let posSize=fitText(ctx,${JSON.stringify(posEn)},TEXT_MAX,54,'{S}px 700 Arial');
  ctx.font=posSize+'px 700 Arial';
  ctx.fillStyle=NAVY; ctx.textAlign='left'; ctx.textBaseline='top';
  ctx.fillText(${JSON.stringify(posEn)}, TX, 540);

  // Position AR (crimson, RTL)
  let posArSize=fitText(ctx,${JSON.stringify(posAr)},TEXT_MAX,46,'bold {S}px Arial');
  ctx.font='bold '+posArSize+'px Arial';
  ctx.fillStyle=CRIMSON; ctx.direction='rtl'; ctx.textAlign='right';
  ctx.fillText(${JSON.stringify(posAr)}, TX+TEXT_MAX, 610);
  ctx.direction='ltr';

  // 5. ID strip
  const ICY=775, IR=44;
  const idCols=[
    {cx:195, label:'Staff ID',    val:${JSON.stringify(staffId||'—')}},
    {cx:620, label:'Job ID',      val:${JSON.stringify(jobId||'—')}},
    {cx:1045,label:'QSS Number',  val:${JSON.stringify(qssNum||'—')}},
  ];
  idCols.forEach(({cx,label,val})=>{
    // Crimson circle
    ctx.fillStyle=CRIMSON;
    ctx.beginPath(); ctx.arc(cx,ICY,IR,0,Math.PI*2); ctx.fill();
    // White icon lines
    ctx.strokeStyle=WHITE; ctx.lineWidth=3;
    drawIcon(ctx,cx,ICY,label);
    // Label
    ctx.font='28px Arial'; ctx.fillStyle=GRAY;
    ctx.textAlign='left'; ctx.textBaseline='top';
    ctx.fillText(label, cx+IR+18, ICY-20);
    // Value
    ctx.font='bold 33px Arial'; ctx.fillStyle=DARK;
    ctx.fillText(val, cx+IR+18, ICY+14);
  });
  // Dividers
  ctx.strokeStyle='#c0c0c0'; ctx.lineWidth=2;
  [418,840].forEach(vx=>{
    ctx.beginPath(); ctx.moveTo(vx,ICY-46); ctx.lineTo(vx,ICY+46); ctx.stroke();
  });

  // 6. Footer
  const FY=930, CR=36;
  // Phone
  drawContactCircle(ctx, 192, FY, CR);
  ctx.font='40px Arial'; ctx.fillStyle=WHITE;
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(${JSON.stringify(phone)}, 192+CR+18, FY);
  // Divider
  ctx.strokeStyle='rgba(201,168,76,0.5)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(650,FY-30); ctx.lineTo(650,FY+30); ctx.stroke();
  // Email
  drawContactCircle(ctx, 726, FY, CR);
  ctx.fillText(${JSON.stringify(email)}, 726+CR+18, FY);

  // Done — enable download
  document.getElementById('dlBtn').onclick=()=>{
    const a=document.createElement('a');
    a.download=${JSON.stringify('ID-Card-'+empName.replace(/\\s+/g,'-')+'.png')};
    a.href=cv.toDataURL('image/png');
    a.click();
  };
  document.getElementById('btns').style.opacity='1';
}

function drawPlaceholder(ctx,CX,CY,R){
  clipCircle(ctx,CX,CY,R);
  ctx.fillStyle='#c8cacd';
  ctx.beginPath(); ctx.arc(CX,CY,R,0,Math.PI*2); ctx.fill();
  // head
  ctx.fillStyle='#969ba0';
  ctx.beginPath(); ctx.arc(CX,CY-R*0.25,R*0.33,0,Math.PI*2); ctx.fill();
  // body
  ctx.beginPath(); ctx.ellipse(CX,CY+R*0.55,R*0.52,R*0.42,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawIcon(ctx,cx,cy,label){
  const iw=22;
  if(label==='Staff ID'){
    ctx.strokeRect(cx-iw,cy-iw,iw*2,iw*2);
    ctx.beginPath(); ctx.moveTo(cx-13,cy-8); ctx.lineTo(cx+13,cy-8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-13,cy+3); ctx.lineTo(cx+6,cy+3); ctx.stroke();
  } else if(label==='Job ID'){
    ctx.strokeRect(cx-iw,cy-8,iw*2,iw+8);
    ctx.beginPath(); ctx.arc(cx,cy-10,10,Math.PI,0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy+2); ctx.lineTo(cx,cy+14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-10,cy+8); ctx.lineTo(cx+10,cy+8); ctx.stroke();
  } else {
    ctx.strokeRect(cx-iw+2,cy-iw+2,iw*2-4,iw*2-4);
    [-9,1,10].forEach(dy=>{
      ctx.beginPath(); ctx.moveTo(cx-13,cy+dy); ctx.lineTo(cx+13,cy+dy); ctx.stroke();
    });
  }
}

function drawContactCircle(ctx,cx,cy,r){
  ctx.strokeStyle=GOLD; ctx.lineWidth=3;
  ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
  // envelope icon
  ctx.strokeStyle=GOLD; ctx.lineWidth=2.5;
  ctx.strokeRect(cx-20,cy-13,40,26);
  ctx.beginPath(); ctx.moveTo(cx-20,cy-13); ctx.lineTo(cx,cy+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+20,cy-13); ctx.lineTo(cx,cy+4); ctx.stroke();
}

draw().catch(e=>{
  document.body.innerHTML='<div style="color:white;padding:40px;font-size:16px">Error: '+e.message+'</div>';
});
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
