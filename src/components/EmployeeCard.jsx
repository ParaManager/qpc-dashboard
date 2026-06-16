import { useLang } from '../lib/LangContext.jsx'

// Reuse same logos from AthleteCard
const QATAR = "data:image/png;base64,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gCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAREQBERAEREAREQBERAbIiK+AEREABERAARUREAREQAEREABERAHqG+YjPUREAiR+giIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAREQBERAEREAREQBERAbIiK+AEREABERAARUREAREQAEREABERAHqG+YjPUREAiR+giIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAREQBERAEREAREQBERAbIiK+AEREABERAARUREAREQAEREABERAnY2RURAa0REQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREARH/2Q=="
const QPC = "data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAH0ASgDASIAAhEBAxEB/8QAHQABAAICAwEBAAAAAAAAAAAAAAYHBQgCAwQBCf/EAFMQAAEDAgIFBwYJCAcIAQUAAAIAAwQBBQYSBxEiMlITITFCYnKCCBQVQZKiI0NRYXGBssLSFiQzU5GhscE0RFRjc+LwFyUmJWR00eE2g5Sjs/L/xAAbAQEAAgMBAQAAAAAAAAAAAAAABAUCAwYBB//EADsRAAEEAAMECAMHAwQDAAAAAAABAgMEBRESEyExUQYUIkFhcYGhMpHRMzRCscHh8BUjUhYkYnI1RYL/2gAMAwEAAhEDEQA/ANyEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBfK6/kXzMNKa61UCxlpXwjhozYdn1nSw3o0OnKlTvV3R8VUNsUEkrtLEzJ/r+ZcCIa/Mtd5GmbG2J7h6MwZh8GnT6KZPOHR7RboD4lJ7Do8x3edUvHONro3QuesG3yMntGOqn1CPiXmrPgTZcMdA3VO9G+HFfkXEJa+Jcli7BZoNkg+Z29pwGteb4V03SrX5akZVJZRela7/iEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEWJmTEvQHUOrHxf3FyCpPTcWn9to+Wou6EHTlSHe4/Sdm+ZcMXrvY0aXQWxjPbR4Q1/emYrE/lvhbXq9MMfTlrq/gqGvj11fYekRDYfuBbhziPkyLtEO0qPxFpR0hYfvLtvutstUZ4NrJyBkJD1SE8+0PaVLUxO7iD1Sq1u7uVd5bvwuCu3+85fQ39t13ttyDNb5seTT18mdK1p9S99C5udaJYL03w3prQXyKVokZtmbGMiAS7XWH3ltDo7x959ViBdZDb1HRHzeYBUyu5t3X6trq16ynNvywSpDcZoVeC9ykWbD26NcDs09yzUTMitysCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgNmspKWsiMVXTxTxkcWyMDh8qg3apaLbZ9Sx01spmU0L6YSOjZnG8XEZx2KeCoV22fdhD+ZN+kVweUEIeqbTW/K3m9p8n6XGdxguEwtzCYUHydw1YWmT+bctzC0yD7W5Wy4BFiNG/cnafzOL6IXbLqtHfcnafzOL6IXar1Oh+VHsRGKnvvtCIiylgREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQAqGNtQ/73Q/mbfpuUzlQztp+6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iIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAREQBERAEREAREQBERAbIiK+AEREABERAARUREAREQAEREABERAHqG+YjPUREAiR+giIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAREQBERAEREAREQBERAbIiK+AEREABERAARUREAREQAEREABERAHqG+YjPUREAiR+giIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAREQBERAEREAREQBERAbIiK+AEREABERAARUREAREQAEREABERAHqG+YjPUREAiR+giIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAREQBERAEREAREQBERAbIiK+AEREABERAARUREAREQAEREABERAnY2RURAa0REQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREARH/2Q=="

const DESIGNATION_AR = {
  'Coach': 'مدرب', 'Assistant Coach': 'مدرب مساعد', 'Technical Expert': 'خبير تقني',
  'Physiotherapist': 'معالج فيزيائي', 'Doctor': 'طبيب',
  'Secretary General': 'الأمين العام', 'Executive Manager': 'مدير تنفيذي',
  'Administration Secretary': 'سكرتير إداري', 'Secretary Assistant': 'مساعد سكرتير',
  'Administrative National Team': 'إداري الفريق الوطني',
  'Administrative Youth Team': 'إداري فريق الشباب',
  'Administrative Center & Development': 'إداري المركز والتطوير',
  'Accountant': 'محاسب', 'Public Relation Officer': 'مسؤول علاقات عامة',
  'Receptionist': 'موظف استقبال', 'Board Member': 'عضو مجلس إدارة',
  'Official': 'مسؤول', 'Delegate': 'مندوب', 'Employee': 'موظف',
  'Store Keeper': 'أمين مخزن', 'Waiter': 'نادل', 'Worker': 'عامل', 'Driver': 'سائق',
}

export function generateEmployeeCard(emp) {
  const desigAr  = DESIGNATION_AR[emp.designation] || emp.designation || ''
  const photoSrc = emp.photo_url || ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Employee Card – ${emp.name || ''}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body {
    background:#f0f0f0;
    font-family:'Arial',sans-serif;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    min-height:100vh;
    gap:20px;
    padding:24px 20px;
  }
  .card {
    width:560px;
    background:#f5f5f5;
    border-radius:18px;
    overflow:hidden;
    display:flex;
    box-shadow:0 8px 40px rgba(0,0,0,.3);
  }
  .stripe {
    width:10px;
    flex-shrink:0;
    background:linear-gradient(180deg,#e91e8c 0%,#c2185b 100%);
  }
  .body {
    flex:1;
    padding:28px 24px 22px 24px;
  }
  .top-row {
    display:flex;
    gap:20px;
    margin-bottom:24px;
  }
  .photo-box {
    width:100px;
    height:110px;
    border-radius:8px;
    overflow:hidden;
    background:#1a3a6b;
    flex-shrink:0;
    display:flex;
    align-items:center;
    justify-content:center;
    border:2px solid #ddd;
  }
  .photo-box img { width:100%; height:100%; object-fit:cover; }
  .name-block {
    display:flex;
    flex-direction:column;
    justify-content:center;
    gap:4px;
  }
  .en-name { font-size:20px; font-weight:700; color:#111; line-height:1.2; }
  .ar-name-wrap { position:relative; padding-bottom:10px; margin-bottom:4px; }
  .ar-name { font-size:15px; font-weight:500; color:#222; direction:rtl; text-align:right; }
  .red-line {
    position:absolute; bottom:0; left:0; right:0;
    height:2px;
    background:linear-gradient(90deg,#e91e8c,#c2185b);
    border-radius:2px;
  }
  .en-pos { font-size:14px; font-weight:500; color:#333; }
  .ar-pos { font-size:13px; color:#555; direction:rtl; text-align:right; }
  .divider { border-top:1px solid #ccc; margin-bottom:16px; }
  .org-block { margin-bottom:12px; }
  .org-en { font-size:13px; font-weight:700; color:#111; margin-bottom:3px; }
  .org-ar { font-size:12px; color:#444; direction:rtl; text-align:right; }
  .divider2 { border-top:1px solid #ccc; margin-bottom:14px; }
  .ids-row { display:flex; gap:20px; margin-bottom:12px; align-items:center; }
  .id-field { display:flex; align-items:center; gap:5px; font-size:12px; color:#222; }
  .id-badge {
    display:inline-flex; align-items:center; justify-content:center;
    width:18px; height:18px; border-radius:4px;
    background:#7c3aed; color:#fff; font-size:9px; font-weight:700;
  }
  .id-label { color:#666; }
  .contact-row { display:flex; gap:20px; align-items:center; font-size:12px; color:#333; }
  .sep { color:#ccc; }
  .logos-col {
    width:72px;
    flex-shrink:0;
    background:#f0f0f0;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:space-around;
    padding:16px 8px;
    border-left:1px solid #e0e0e0;
  }
  .logo-box {
    width:52px; height:52px; border-radius:8px; overflow:hidden;
    background:#fff; display:flex; align-items:center; justify-content:center;
    border:1px solid #ddd;
  }
  .logo-box img { width:100%; height:100%; object-fit:contain; }
  .btns { display:flex; gap:12px; margin-top:4px; }
  .btn {
    padding:10px 22px; border-radius:10px; border:none;
    font-family:Arial,sans-serif; font-size:13px; font-weight:600; cursor:pointer;
  }
  @media print {
    body { background:white; justify-content:flex-start; padding:0; gap:0; }
    .card { box-shadow:none; border-radius:0; }
    .btns { display:none !important; }
  }
</style>
</head>
<body>

<div class="card">
  <div class="stripe"></div>
  <div class="body">
    <div class="top-row">
      <div class="photo-box">
        ${photoSrc
          ? `<img src="${photoSrc}" alt="${emp.name || ''}"/>`
          : `<svg width="60" height="70" viewBox="0 0 60 70" fill="none">
               <circle cx="30" cy="24" r="14" fill="#4a7ab5" opacity=".8"/>
               <ellipse cx="30" cy="62" rx="24" ry="16" fill="#4a7ab5" opacity=".8"/>
             </svg>`
        }
      </div>
      <div class="name-block">
        <div class="en-name">${emp.name || 'Full Name'}</div>
        <div class="ar-name-wrap">
          <div class="ar-name">${emp.name_ar || 'الاسم الكامل'}</div>
          <div class="red-line"></div>
        </div>
        <div class="en-pos">${emp.designation || 'Position Name'}</div>
        <div class="ar-pos">${emp.designation_ar || desigAr || 'المسمى الوظيفي'}</div>
      </div>
    </div>

    <div class="divider"></div>

    <div class="org-block">
      <div class="org-en">Qatar Paralympic Committee</div>
      <div class="org-ar">الاتحاد القطري لرياضة ذوي الاحتياجات الخاصة</div>
    </div>

    <div class="divider2"></div>

    <div class="ids-row">
      <div class="id-field">
        <span class="id-badge">ID</span>
        <span class="id-label">Staff ID :</span>
        <span style="font-weight:600">${emp.employee_number || '00000'}</span>
      </div>
      <div class="id-field">
        <span class="id-badge">ID</span>
        <span class="id-label">Job ID :</span>
        <span style="font-weight:600">${emp.job_id || '0000'}</span>
      </div>
      <div class="id-field">
        <span class="id-badge">ID</span>
        <span class="id-label">QSS ID :</span>
        <span style="font-weight:600">${emp.qss_number || '000000'}</span>
      </div>
    </div>

    <div class="contact-row">
      <span>📞 ${emp.phone || '00000000'}</span>
      <span class="sep">|</span>
      <span>✉️ ${emp.email || 'name@email.com'}</span>
    </div>
  </div>

  <div class="logos-col">
    <div class="logo-box">
      <img src="${QPC}" alt="QPC"/>
    </div>
    <div class="logo-box">
      <img src="${QATAR}" alt="Qatar"/>
    </div>
  </div>
</div>

<div class="btns">
  <button class="btn" onclick="window.print()" style="background:#e91e8c;color:#fff">
    🖨️ Print Card
  </button>
  <button class="btn" onclick="if(window.opener){window.close();}else{history.back();}" style="background:#fff;color:#444;border:1.5px solid #ddd">
    ✕ Close
  </button>
</div>

</body>
</html>`

  return html
}

export default function EmployeeCardButton({ emp }) {
  const { lang } = useLang()
  const ar = lang === 'ar'

  function handleGenerate() {
    const html = generateEmployeeCard(emp)
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  return (
    <button
      onClick={handleGenerate}
      className="action-btn"
      style={{
        borderColor: '#e91e8c',
        color: '#e91e8c',
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = '#fce4f3' }}
      onMouseLeave={e => { e.currentTarget.style.background = '' }}
    >
      <i className="ti ti-id-badge" style={{ fontSize: 14 }} />
      <span>{ar ? 'إنشاء البطاقة' : 'Employee Card'}</span>
    </button>
  )
}
