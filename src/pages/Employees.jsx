import { useState, useEffect, useRef } from 'react'
import { initials, statusClass, effectiveStatus, COACH_DESIGNATIONS, buildSearchText, matchesSearch, extractQidFromFilename, normalizeQid, SUPPORTED_DOC_FILE_TYPES, MAX_DOC_FILE_SIZE_BYTES } from '../lib/helpers'
import DesignationField from '../components/DesignationField'
import PersonDocuments from '../components/PersonDocuments'
import ImportCompletionSummary from '../components/ImportCompletionSummary'
import { DOC_TYPES, DOC_TYPES_AR } from '../lib/documentTypes'
import { SHARED_TYPES } from '../lib/documentEngine'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { isTrustedAdmin } from '../lib/permissions'
import { logAdminActivity } from '../lib/adminActivity'
import CareerHistory from '../components/CareerHistory.jsx'
import { useLang } from '../lib/LangContext.jsx'
import * as XLSX from 'xlsx'
import EmployeeCardButton from '../components/EmployeeCard'
import PhotoCropModal from '../components/PhotoCropModal'
import { usePersonRoles, RoleBadges } from '../components/RoleBadges.jsx'
import NationalitySelect from '../components/NationalitySelect.jsx'
import MultiSelectFilter from '../components/MultiSelectFilter.jsx'
import StatusScopeModal from '../components/StatusScopeModal.jsx'

// Nationality comes entirely from the shared nationalities table (NationalitySelect.jsx / useNationalities.js) — no hardcoded country lists here.

function formatFriendlyDate(dateStr, ar) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(ar ? 'ar-QA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const DESIG_COLORS = {
  'Coach': '#009F6B', 'Assistant Coach': '#009F6B', 'Technical Expert': '#009F6B',
  'Physiotherapist': '#EE334E', 'Doctor': '#EE334E',
  'Secretary General': '#0085C7', 'Executive Manager': '#0085C7',
  'Board Member': '#8b5cf6', 'Official': '#8b5cf6', 'Delegate': '#8b5cf6',
  'Administration Secretary': '#e67e22', 'Secretary Assistant': '#e67e22',
  'Administrative National Team': '#e67e22', 'Administrative Youth Team': '#e67e22',
  'Administrative Center & Development': '#e67e22',
  'Accountant': '#16a085', 'Public Relation Officer': '#16a085',
  'Receptionist': '#9aa3b2', 'Employee': '#9aa3b2',
  'Store Keeper': '#9aa3b2', 'Waiter': '#9aa3b2', 'Worker': '#9aa3b2', 'Driver': '#9aa3b2',
}

function DesigBadge({ label, displayLabel }) {
  const color = DESIG_COLORS[label] || '#9aa3b2'
  return (
    <span style={{ display:'inline-flex', alignItems:'center', fontSize:11, padding:'3px 9px', borderRadius:20, fontWeight:500, background:color+'18', color }}>
      {displayLabel || label}
    </span>
  )
}

function exportEmployeesPDF(emp, lang, coaches) {
  const isAr = lang === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'
  const L = (en, ar) => isAr ? ar : en
  const field = (k, v) => {
    const clean = (v === null || v === undefined || v === 'null' || v === 'undefined' || v === '') ? null : v
    return clean ? `<div class="field"><span class="k">${k}</span><span class="v">${clean}</span></div>` : ''
  }
  const color = DESIG_COLORS[emp.designation] || '#9aa3b2'
  const DESIG_AR_MAP = {'Coach':'مدرب','Assistant Coach':'مدرب مساعد','Technical Expert':'خبير تقني','Physiotherapist':'معالج فيزيائي','Doctor':'طبيب','Secretary General':'الأمين العام','Executive Manager':'مدير تنفيذي','Administration Secretary':'سكرتير إداري','Secretary Assistant':'مساعد سكرتير','Administrative National Team':'إداري الفريق الوطني','Administrative Youth Team':'إداري فريق الشباب','Administrative Center & Development':'إداري المركز والتطوير','Accountant':'محاسب','Public Relation Officer':'مسؤول علاقات عامة','Receptionist':'موظف استقبال','Board Member':'عضو مجلس إدارة','Official':'مسؤول','Delegate':'مندوب','Employee':'موظف','Store Keeper':'أمين مخزن','Waiter':'نادل','Worker':'عامل','Driver':'سائق'}
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','When needed':'عند الحاجة','External':'خارجي','Retired':'متقاعد'}
  const COUNTRY_AR = {'Qatar':'قطر','Egypt':'مصر','Algeria':'الجزائر','Jordan':'الأردن','Tunisia':'تونس','Morocco':'المغرب','Saudi Arabia':'المملكة العربية السعودية','Somalia':'الصومال','Ireland':'أيرلندا','Spain':'إسبانيا','France':'فرنسا','UK':'المملكة المتحدة','USA':'الولايات المتحدة','Sudan':'السودان','Libya':'ليبيا','Pakistan':'باكستان','India':'الهند'}

  const html = `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr?'ar':'en'}"><head><meta charset="UTF-8"/>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; color:#1a1d23; padding:32px; font-size:13px; direction:${dir}; }
  .header { display:flex; align-items:center; gap:20px; margin-bottom:24px; padding-bottom:20px; border-bottom:3px solid #0085C7; }
  .dots { display:flex; gap:5px; }
  .dot { width:14px; height:14px; border-radius:50%; }
  h1 { font-size:20px; font-weight:700; color:#0a1628; }
  .sub { font-size:12px; color:#9aa3b2; margin-top:2px; }
  .profile { display:flex; gap:20px; margin-bottom:24px; }
  .photo { width:80px; height:80px; border-radius:50%; background:${color}; display:flex; align-items:center; justify-content:center; color:#fff; font-size:28px; font-weight:700; flex-shrink:0; overflow:hidden; }
  .photo img { width:100%; height:100%; object-fit:cover; }
  .section-title { font-size:11px; font-weight:700; color:#9aa3b2; text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; padding-bottom:6px; border-bottom:1px solid #e2e5ea; margin-top:20px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
  .field { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f0f1f3; font-size:12px; }
  .field .k { color:#5a6272; }
  .field .v { font-weight:600; text-align:${isAr?'left':'right'}; }
  .footer { margin-top:32px; padding-top:12px; border-top:1px solid #e2e5ea; font-size:10px; color:#9aa3b2; text-align:center; }
</style></head><body>
<div class="no-print" style="position:fixed;top:16px;left:16px;z-index:999">
  <button onclick="if(window.opener||window.history.length<=1){window.close()}else{history.back()}"
    style="display:flex;align-items:center;gap:6px;padding:9px 18px;background:#0a1628;color:#fff;border:none;border-radius:10px;font-size:14px;cursor:pointer;font-family:Arial;box-shadow:0 2px 12px rgba(0,0,0,.3)">
    &#8592; Back
  </button>
</div>

<div class="header">
  <div class="dots">
    <div class="dot" style="background:#EE334E"></div>
    <div class="dot" style="background:#0085C7"></div>
    <div class="dot" style="background:#009F6B"></div>
  </div>
  <div>
    <h1>${isAr?'الاتحاد القطري لذوي الاحتياجات الخاصة':'Qatar Paralympic Committee'}</h1>
    <p class="sub">${isAr?`ملف الموظف الرسمي · تم الإنشاء ${new Date().toLocaleDateString('ar-QA')}`:`Employee Profile · Generated ${new Date().toLocaleDateString()}`}</p>
  </div>
</div>

<div class="profile">
  <div class="photo">${emp.photo_url?`<img src="${emp.photo_url}"/>`:initials(emp.name)}</div>
  <div>
    <div style="font-size:22px;font-weight:700">${isAr && emp.name_ar ? emp.name_ar : emp.name}</div>
    <div style="font-size:14px;color:#5a6272;margin-top:3px">${isAr && emp.name_ar ? emp.name : (emp.name_ar||'')}</div>
    <div style="margin-top:8px;font-size:13px;font-weight:600;color:${color}">
      ${isAr ? (emp.designation_ar||emp.designation||'') : (emp.designation||'')}
    </div>
  </div>
</div>

<div class="section-title">${L('Staff Information','معلومات الكادر')}</div>
<div class="grid-2">
  ${field(L('Staff Number','رقم الكادر'), emp.employee_number)}
  ${field(L('QSS #','رقم QSS'), emp.qss_number)}
  ${field(L('Gender','الجنس'), emp.gender ? (isAr?(emp.gender==='Male'?'ذكر':'أنثى'):emp.gender) : null)}
  ${field(L('Nationality','الجنسية'), isAr?(COUNTRY_AR[emp.nationality]||emp.nationality):emp.nationality)}
  ${field(L('Status','الحالة'), (() => { const es = effectiveStatus(employeeStatusSource(emp, coaches)); return isAr?(STATUS_AR[es]||es):es })())}
  ${field(L('Phone','الهاتف'), emp.phone)}
  ${field(L('Email','البريد الإلكتروني'), emp.email)}
</div>

${emp.notes ? `<div class="section-title">${L('Notes','ملاحظات')}</div><p style="font-size:12px;color:#5a6272;line-height:1.6;margin-top:8px">${emp.notes}</p>` : ''}

<div class="footer">${isAr?'الاتحاد القطري لذوي الاحتياجات الخاصة · سري · ':'Qatar Paralympic Committee · Confidential · '}${new Date().getFullYear()}</div>
</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
  setTimeout(() => win.print(), 500)
}

function exportIDCard(emp) {
  const name    = emp.name || ''
  const nameAr  = emp.name_ar || ''
  const desig   = emp.designation || ''
  const desigAr = emp.designation_ar || ''
  const staffId = emp.employee_number ? `QPC-${emp.employee_number}` : ''
  const jobId   = emp.job_id || ''
  const qssNum  = emp.qss_number ? `QSS-${emp.qss_number}` : ''
  const phone   = emp.phone || ''
  const email   = emp.email || ''
  const photo   = emp.photo_url || ''
  const ini     = name.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase()

  // Approximate the card background, swooshes, and layout in pure HTML/CSS.
  // Logos are rendered as text/SVG stubs since we don't want to embed full
  // copyrighted raster files — the actual logos can be swapped in via <img>
  // once hosted in public/ if needed.
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>ID Card — ${name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @media print {
    body { margin: 0; }
    .no-print { display: none !important; }
    @page { size: 85.6mm 54mm; margin: 0; }
  }
  body {
    font-family: Arial, 'Segoe UI', sans-serif;
    background: #e0e0e0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }
  .no-print {
    margin-bottom: 16px;
    display: flex;
    gap: 10px;
  }
  .btn {
    padding: 10px 22px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-family: Arial;
    font-weight: 600;
  }
  .btn-back { background: #2d3748; color: #fff; }
  .btn-print { background: #7b1432; color: #fff; }

  /* CARD */
  .card {
    width: 856px;
    height: 540px;
    background: #f8f6f3;
    border-radius: 28px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  }

  /* Top-left crimson decorative corner */
  .corner-tl {
    position: absolute;
    top: 0; left: 0;
    width: 220px;
    height: 300px;
    background: #7b1432;
    clip-path: ellipse(180px 260px at 0% 0%);
    z-index: 1;
  }
  .corner-tl-inner {
    position: absolute;
    top: 0; left: 0;
    width: 170px;
    height: 240px;
    background: #6a1028;
    clip-path: ellipse(140px 200px at 0% 0%);
    z-index: 1;
  }

  /* Gold accent line on corner */
  .gold-arc {
    position: absolute;
    top: 60px; left: -20px;
    width: 300px;
    height: 320px;
    border: 3px solid #c9a84c;
    border-radius: 50%;
    z-index: 2;
    opacity: 0.8;
  }

  /* Bottom crimson swoosh */
  .swoosh-bottom {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 170px;
    background: #7b1432;
    clip-path: ellipse(110% 170px at 35% 100%);
    z-index: 1;
  }
  .swoosh-bottom-dark {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 140px;
    background: #6a1028;
    clip-path: ellipse(110% 140px at 30% 100%);
    z-index: 2;
  }

  /* Gold swoosh line */
  .gold-swoosh {
    position: absolute;
    bottom: 138px; left: -20px;
    width: 120%;
    height: 8px;
    background: linear-gradient(to right, #c9a84c, #f0d060, #c9a84c, transparent);
    transform: rotate(-3deg);
    z-index: 3;
  }
  .gold-dot-end {
    position: absolute;
    bottom: 143px;
    left: 42%;
    width: 12px; height: 12px;
    background: #c9a84c;
    border-radius: 50%;
    z-index: 4;
  }

  /* Right-side decorative dots grid */
  .dots-grid {
    position: absolute;
    bottom: 155px; right: 18px;
    width: 110px; height: 80px;
    z-index: 3;
  }
  .dots-grid span {
    position: absolute;
    width: 5px; height: 5px;
    background: #c9a84c;
    border-radius: 50%;
    opacity: 0.55;
  }

  /* Photo circle */
  .photo-wrap {
    position: absolute;
    top: 88px; left: 38px;
    width: 200px; height: 200px;
    border-radius: 50%;
    border: 4px solid #c9a84c;
    overflow: hidden;
    background: #e0e0e0;
    z-index: 5;
    display: flex; align-items: center; justify-content: center;
  }
  .photo-wrap img { width: 100%; height: 100%; object-fit: cover; }
  .photo-initials {
    font-size: 52px; font-weight: 700;
    color: #7b1432;
    font-family: Arial;
  }

  /* LOGOS row — equal-width 3-column grid so spacing stays balanced
     regardless of each logo's own content width. */
  .logos {
    position: absolute;
    top: 28px; left: 270px;
    width: 540px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: stretch;
    z-index: 5;
  }
  .logo-cell {
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-cell img { max-height: 100%; width: auto; object-fit: contain; }
  .logo-qpc {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .logo-qpc-icon {
    width: 44px; height: 52px;
  }
  .logo-qpc-text { line-height: 1.2; }
  .logo-qpc-text .en { font-size: 12px; font-weight: 700; color: #7b1432; }
  .logo-qpc-text .ar { font-size: 10px; color: #7b1432; }
  .logo-qatar {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .logo-qatar-badge {
    width: 42px; height: 42px;
    background: #7b1432;
    clip-path: polygon(50% 0%, 100% 12%, 100% 75%, 50% 100%, 0% 75%, 0% 12%);
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; color: #fff; font-weight: 700; text-align: center;
    line-height: 1.1;
  }
  .logo-so {
    display: flex; flex-direction: column; align-items: center; gap: 1px;
  }
  .logo-so-text { font-size: 13px; font-weight: 900; color: #e8232a; font-style: italic; }
  .logo-so-sub { font-size: 10px; color: #555; }
  .logo-so-sub-ar { font-size: 9px; color: #555; }

  /* Content area */
  .content {
    position: absolute;
    top: 105px; left: 270px;
    z-index: 5;
    max-width: 540px;
  }
  .full-name-en {
    font-size: 36px;
    font-weight: 900;
    color: #1a1d23;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .full-name-ar {
    font-size: 22px;
    color: #1a1d23;
    margin-top: 4px;
    font-weight: 400;
    direction: rtl;
  }
  .name-divider {
    width: 100%;
    height: 1px;
    background: #c9a84c;
    margin: 10px 0;
  }
  .position-en {
    font-size: 20px;
    font-weight: 700;
    color: #1a1d23;
    margin-top: 6px;
  }
  .position-ar {
    font-size: 16px;
    color: #7b1432;
    margin-top: 3px;
    direction: rtl;
  }

  /* Info bar (Staff ID / Job ID / QSS) */
  .info-bar {
    position: absolute;
    bottom: 155px; left: 0; right: 0;
    display: flex;
    align-items: center;
    z-index: 5;
    padding: 0 32px;
  }
  .info-item {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }
  .info-icon {
    width: 38px; height: 38px;
    border-radius: 50%;
    background: #7b1432;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .info-icon svg { width: 18px; height: 18px; fill: none; stroke: #fff; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
  .info-label { font-size: 11px; color: #5a6272; font-weight: 600; }
  .info-value { font-size: 13px; font-weight: 700; color: #1a1d23; margin-top: 1px; }
  .info-sep { width: 1px; height: 44px; background: #c9a84c; margin: 0 16px; opacity: 0.6; }

  /* Footer bar (phone / email) */
  .footer-bar {
    position: absolute;
    bottom: 18px; left: 0; right: 0;
    display: flex;
    align-items: center;
    z-index: 6;
    padding: 0 50px;
    gap: 40px;
  }
  .footer-item {
    display: flex; align-items: center; gap: 10px;
  }
  .footer-icon {
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 1.5px solid #c9a84c;
    display: flex; align-items: center; justify-content: center;
  }
  .footer-icon svg { width: 14px; height: 14px; fill: none; stroke: #c9a84c; stroke-width: 1.8; stroke-linecap: round; }
  .footer-text { font-size: 14px; color: #fff; font-weight: 500; }
  .footer-sep { width: 1px; height: 30px; background: #c9a84c; opacity: 0.4; }

  /* Skyline watermark on bottom-right */
  .skyline {
    position: absolute;
    bottom: 55px; right: 0;
    width: 380px; height: 90px;
    opacity: 0.18;
    z-index: 4;
  }
</style>
</head><body>

<div class="no-print">
  <button class="btn btn-back" onclick="if(window.opener||window.history.length<=1){window.close()}else{history.back()}">← Back</button>
  <button class="btn btn-print" onclick="window.print()">🖨 Print / Save PDF</button>
</div>

<div class="card">

  <!-- Corner decorations -->
  <div class="corner-tl"></div>
  <div class="corner-tl-inner"></div>
  <div class="gold-arc"></div>

  <!-- Bottom swoosh -->
  <div class="swoosh-bottom"></div>
  <div class="swoosh-bottom-dark"></div>
  <div class="gold-swoosh"></div>
  <div class="gold-dot-end"></div>

  <!-- Dots grid -->
  <div class="dots-grid">
    ${Array.from({length:5},(_,r)=>Array.from({length:6},(_,c)=>`<span style="top:${r*16}px;left:${c*18}px"></span>`).join('')).join('')}
  </div>

  <!-- Skyline silhouette (simplified SVG watermark) -->
  <svg class="skyline" viewBox="0 0 380 90" xmlns="http://www.w3.org/2000/svg" fill="#7b1432">
    <rect x="0" y="60" width="380" height="30"/>
    <rect x="20" y="40" width="12" height="20"/>
    <rect x="38" y="30" width="10" height="30"/>
    <rect x="54" y="45" width="8" height="15"/>
    <rect x="68" y="25" width="14" height="35"/>
    <rect x="71" y="15" width="8" height="10"/>
    <rect x="88" y="35" width="10" height="25"/>
    <rect x="104" y="20" width="16" height="40"/>
    <rect x="107" y="8" width="10" height="12"/>
    <rect x="126" y="38" width="10" height="22"/>
    <rect x="142" y="28" width="12" height="32"/>
    <rect x="160" y="42" width="8" height="18"/>
    <rect x="174" y="18" width="18" height="42"/>
    <rect x="178" y="5" width="10" height="13"/>
    <rect x="198" y="32" width="14" height="28"/>
    <rect x="218" y="44" width="9" height="16"/>
    <rect x="232" y="22" width="16" height="38"/>
    <rect x="254" y="38" width="10" height="22"/>
    <rect x="268" y="28" width="14" height="32"/>
    <rect x="288" y="50" width="8" height="10"/>
    <rect x="300" y="35" width="12" height="25"/>
    <rect x="318" y="44" width="10" height="16"/>
    <rect x="332" y="30" width="16" height="30"/>
    <rect x="352" y="48" width="8" height="12"/>
    <rect x="364" y="38" width="10" height="22"/>
  </svg>

  <!-- Photo -->
  <div class="photo-wrap">
    ${photo ? `<img src="${photo}" alt="${name}"/>` : `<div class="photo-initials">${ini}</div>`}
  </div>

  <!-- Logos -->
  <div class="logos">
    <!-- QPC -->
    <div class="logo-cell">
      <div class="logo-qpc">
        <svg class="logo-qpc-icon" viewBox="0 0 44 52" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M22 2 L40 10 L40 36 L22 50 L4 36 L4 10 Z" fill="#7b1432" stroke="#c9a84c" stroke-width="1.5"/>
          <text x="22" y="28" text-anchor="middle" fill="white" font-size="7" font-weight="bold" font-family="Arial">QPC</text>
          <circle cx="22" cy="18" r="7" fill="none" stroke="white" stroke-width="1.2"/>
          <path d="M19 15 L22 12 L25 15" fill="white"/>
        </svg>
        <div class="logo-qpc-text">
          <div class="en">Qatar<br/>Paralympic<br/>Committee</div>
          <div class="ar">اللجنة البارالمبية القطرية</div>
        </div>
      </div>
    </div>
    <!-- Qatar emblem -->
    <div class="logo-cell">
      <div class="logo-qatar">
        <div class="logo-qatar-badge">قطر<br/>QATAR</div>
        <svg width="32" height="14" viewBox="0 0 32 14">
          <circle cx="4" cy="7" r="4" fill="#0085C7"/>
          <circle cx="12" cy="7" r="4" fill="#EE334E"/>
          <circle cx="20" cy="7" r="4" fill="#009F6B"/>
          <circle cx="28" cy="7" r="4" fill="#f1c40f"/>
        </svg>
      </div>
    </div>
    <!-- Special Olympics -->
    <div class="logo-cell">
      <div class="logo-so">
        <div class="logo-so-text">Special<br/>Olympics</div>
        <div class="logo-so-sub">Qatar</div>
        <div class="logo-so-sub-ar">الأولمبياد الخاص قطر</div>
      </div>
    </div>
  </div>

  <!-- Name + Position -->
  <div class="content">
    <div class="full-name-en">${name}</div>
    ${nameAr ? `<div class="full-name-ar">${nameAr}</div>` : ''}
    <div class="name-divider"></div>
    <div class="position-en">${desig}</div>
    ${desigAr ? `<div class="position-ar">${desigAr}</div>` : ''}
  </div>

  <!-- Info bar -->
  <div class="info-bar">
    <div class="info-item">
      <div class="info-icon">
        <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/><circle cx="17" cy="17" r="3"/></svg>
      </div>
      <div>
        <div class="info-label">Staff ID</div>
        <div class="info-value">${staffId || '—'}</div>
      </div>
    </div>
    <div class="info-sep"></div>
    <div class="info-item">
      <div class="info-icon">
        <svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
      </div>
      <div>
        <div class="info-label">Job ID</div>
        <div class="info-value">${jobId || '—'}</div>
      </div>
    </div>
    <div class="info-sep"></div>
    <div class="info-item">
      <div class="info-icon">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="12" y2="17"/></svg>
      </div>
      <div>
        <div class="info-label">QSS Number</div>
        <div class="info-value">${qssNum || '—'}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer-bar">
    <div class="footer-item">
      <div class="footer-icon">
        <svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.39 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.9a16 16 0 0 0 6 6l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17z"/></svg>
      </div>
      <div class="footer-text">${phone || '+974 44040200'}</div>
    </div>
    <div class="footer-sep"></div>
    <div class="footer-item">
      <div class="footer-icon">
        <svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      </div>
      <div class="footer-text">${email || 'info@qpc.qa'}</div>
    </div>
  </div>

</div>

</body></html>`

  const win = window.open('', '_blank')
  win.document.write(html)
  win.document.close()
}

function exportEmployeesExcel(list, lang, coaches) {
  const ar = lang === 'ar'
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','When needed':'عند الحاجة','External':'خارجي','Retired':'متقاعد'}
  const DESIG_AR_MAP = {'Coach':'مدرب','Assistant Coach':'مدرب مساعد','Technical Expert':'خبير تقني','Physiotherapist':'معالج فيزيائي','Doctor':'طبيب','Secretary General':'الأمين العام','Executive Manager':'مدير تنفيذي','Administration Secretary':'سكرتير إداري','Secretary Assistant':'مساعد سكرتير','Administrative National Team':'إداري الفريق الوطني','Administrative Youth Team':'إداري فريق الشباب','Administrative Center & Development':'إداري المركز والتطوير','Accountant':'محاسب','Public Relation Officer':'مسؤول علاقات عامة','Receptionist':'موظف استقبال','Board Member':'عضو مجلس إدارة','Official':'مسؤول','Delegate':'مندوب','Employee':'موظف','Store Keeper':'أمين مخزن','Waiter':'نادل','Worker':'عامل','Driver':'سائق'}
  const COUNTRY_MAP = {'qatar':'قطر','egypt':'مصر','algeria':'الجزائر','morocco':'المغرب','jordan':'الأردن','saudi arabia':'المملكة العربية السعودية','uae':'الإمارات','kuwait':'الكويت','bahrain':'البحرين','oman':'عُمان','iraq':'العراق','syria':'سوريا','lebanon':'لبنان','yemen':'اليمن','somalia':'الصومال','sudan':'السودان','libya':'ليبيا','tunisia':'تونس','pakistan':'باكستان','india':'الهند','iran':'إيران','turkey':'تركيا','ireland':'أيرلندا','france':'فرنسا','spain':'إسبانيا','germany':'ألمانيا','uk':'المملكة المتحدة','usa':'الولايات المتحدة'}
  const tc = n => n ? (ar ? (COUNTRY_MAP[n.toLowerCase().trim()]||n) : n) : ''
  const L = (en, a) => ar ? a : en

  const rows = list.map(e => ({
    [L('Name','الاسم')]:                  ar && e.name_ar ? e.name_ar : (e.name||''),
    [L('English Name','الاسم بالإنجليزي')]:  ar && e.name_ar ? e.name : (e.name_ar||''),
    [L('Designation','المسمى الوظيفي')]: ar ? (e.designation_ar||e.designation||'') : (e.designation||''),
    [L('Designation AR','المسمى بالعربي')]: e.designation_ar || '',
    [L('Gender','الجنس')]:             e.gender ? (ar?(e.gender==='Male'?'ذكر':'أنثى'):e.gender) : '',
    [L('Nationality','الجنسية')]:      tc(e.nationality),
    [L('Staff Number','رقم الكادر')]:    e.employee_number || '',
    [L('QSS #','رقم QSS')]:           e.qss_number || '',
    [L('Phone','الهاتف')]:             e.phone || '',
    [L('Email','البريد الإلكتروني')]:   e.email || '',
    [L('Status','الحالة')]:            (() => { const es = effectiveStatus(employeeStatusSource(e, coaches)); return ar ? (STATUS_AR[es]||es||'') : (es||'') })(),
    [L('Notes','ملاحظات')]:            e.notes || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{wch:24},{wch:24},{wch:28},{wch:24},{wch:8},{wch:16},{wch:14},{wch:10},{wch:16},{wch:26},{wch:10},{wch:30}]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, ar ? 'الكادر' : 'Staff')
  XLSX.writeFile(wb, `QPC_${ar?'الكادر':'Staff'}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

function EmpModal({ data, isEdit, onClose, onSave, employees = [], customDesignations = [], onDesignationAdded }) {
  const [form, setForm] = useState(data || { status:'Active' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const { lang } = useLang()
  const ar = lang === 'ar'
  const inp = (name, type='text', placeholder='') => (
    <input className="form-input" type={type} placeholder={placeholder}
      value={form[name]||''} onChange={e => set(name, e.target.value)} />
  )
  const sel = (name, options) => (
    <select className="form-input" value={form[name]||''} onChange={e => set(name, e.target.value)}>
      {options.map(o => <option key={o.value??o} value={o.value??o}>{o.label??o}</option>)}
    </select>
  )
  const grp = (label, field) => (
    <div className="form-group"><label className="form-label">{label}</label>{field}</div>
  )
  const DATE_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']
  const statusOpts = [
    { value:'Active',            label: ar?'نشط':'Active' },
    { value:'On Leave',          label: ar?'في إجازة':'On Leave' },
    { value:'In Competition',    label: ar?'في منافسة':'In Competition' },
    { value:'In Training Camp',  label: ar?'في معسكر تدريبي':'In Training Camp' },
    { value:'When needed',       label: ar?'عند الحاجة':'When needed' },
    { value:'External',          label: ar?'خارجي':'External' },
    { value:'Inactive',          label: ar?'غير نشط':'Inactive' },
    { value:'Retired',           label: ar?'متقاعد':'Retired' },
  ]
  // Rule 4: clear the temporary dates in form state as soon as the status
  // is changed away from a dated one, so stale values can't linger even
  // before Save is pressed (handleSave also guards this at the write side).
  const setStatus = (v) => {
    set('status', v)
    if (!DATE_STATUSES.includes(v)) { set('status_start', null); set('status_end', null) }
  }
  const genderOpts = [
    { value:'',       label: '' },
    { value:'Male',   label: ar?'ذكر':'Male' },
    { value:'Female', label: ar?'أنثى':'Female' },
  ]

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? (ar?'تعديل':'Edit') : (ar?'إضافة':'New')} {ar?'عضو كادر':'Staff Member'}</div>
          <button className="modal-close" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div className="form-section">{ar?'المعلومات الشخصية':'Personal Information'}</div>
          <div className="form-row">
            {grp(ar?'الاسم الكامل (إنجليزي)':'Full name (English)', inp("name", "text", "e.g. Ahmed Al-Ansari"))}
            {grp(ar?'الاسم الكامل (عربي)':'Full name (Arabic)', inp("name_ar", "text", "أحمد الأنصاري"))}
          </div>
          <div className="form-row">
            {grp(ar?'الجنس':'Gender', sel("gender", genderOpts))}
            {grp(ar?'الجنسية':'Nationality', <NationalitySelect value={form.nationality} onChange={v => set('nationality', v)} lang={lang} />)}
          </div>
          <div className="form-section">{ar?'الدور والتوظيف':'Role & Employment'}</div>
          <div className="form-row">
            {grp(ar?'المسمى الوظيفي':'Designation', (
              <DesignationField
                employees={employees}
                customDesignations={customDesignations}
                onDesignationAdded={onDesignationAdded}
                value={form.designation}
                valueAr={form.designation_ar}
                onSelect={(label, labelAr) => setForm(f => ({ ...f, designation: label, designation_ar: labelAr || f.designation_ar }))}
                ar={ar}
              />
            ))}
          </div>
          <div className="form-row">
            {grp(ar?'رقم الكادر':'Staff Number', inp("employee_number", "text", "e.g. 12501"))}
            {grp(ar?'رقم QSS':'QSS number', inp("qss_number", "text", "e.g. 50112"))}
          </div>
          <div className="form-row">
            {grp(ar?'رقم المنصب (Job ID)':'Job ID', inp("job_id", "text", "e.g. QPC-J0001"))}
          </div>
          <div className="form-row">
            {grp(ar?'الحالة':'Status', (
              <select className="form-input" value={form.status||''} onChange={e => setStatus(e.target.value)}>
                {statusOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ))}
            {DATE_STATUSES.includes(form.status) && grp(ar?'تاريخ البداية':'Start date', (
              <input type="date" className="form-input" value={form.status_start||''} onChange={e=>set('status_start', e.target.value||null)} />
            ))}
          </div>
          {DATE_STATUSES.includes(form.status) && (
            <div className="form-row">
              {grp(ar?'تاريخ الرجوع':'Return date', (
                <input type="date" className="form-input" value={form.status_end||''} onChange={e=>set('status_end', e.target.value||null)} />
              ))}
            </div>
          )}
          <div className="form-section">{ar?'معلومات الاتصال':'Contact'}</div>
          <div className="form-row">
            {grp(ar?'الهاتف':'Phone', inp("phone", "text", "+974 XXXX XXXX"))}
            {grp(ar?'البريد الإلكتروني':'Email', inp("email", "email", "name@qpc.qa"))}
          </div>
          <div className="form-section">{ar?'وثائق الهوية':'Identity Documents'}</div>
          <div className="form-row">
            {grp(ar?'تاريخ الميلاد':'Date of birth', inp("dob", "date"))}
            {grp(ar?'الرقم الشخصي / رقم الهوية':'Qatar ID number', inp("id_number", "text", "e.g. 26263400099"))}
          </div>
          <div className="form-row">
            {grp(ar?'تاريخ انتهاء الهوية':'ID expiry', inp("id_expiry", "date"))}
            {grp(ar?'رقم جواز السفر':'Passport number', inp("passport_number", "text", "e.g. 01719522"))}
          </div>
          <div className="form-row">
            {grp(ar?'تاريخ انتهاء الجواز':'Passport expiry', inp("passport_expiry", "date"))}
            {grp(ar?'شهادة اديل':'ADEL Certificate', inp("adel_certificate", "text"))}
          </div>
          <div className="form-group">
            <label className="form-label">{ar?'ملاحظات':'Notes'}</label>
            <textarea className="form-input" rows={3} value={form.notes||''} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{ar?'إلغاء':'Cancel'}</button>
          <button className="btn btn-blue" onClick={() => onSave(form, isEdit)}>
            {isEdit ? (ar?'حفظ التغييرات':'Save changes') : (ar?'إضافة عضو كادر':'Add staff member')}
          </button>
        </div>
      </div>
    </div>
  )
}

// Rule 7: coach-type employees show the coaches table's own status, not the
// employees table's — this one helper is now the single place that decides
// which record's status actually applies to a given employee, reused by the
// list badge, the detail-view badge, and the status column filter, so the
// three can never drift out of sync with each other.
function employeeStatusSource(emp, coaches) {
  if (!COACH_DESIGNATIONS.includes(emp.designation)) return emp
  const coachRec = coaches?.find(c => c.status !== 'Inactive' && (
    (emp.qss_number && c.qss_number && c.qss_number === emp.qss_number) ||
    (emp.name && c.name && c.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
  ))
  return coachRec || emp
}

// ── Bulk Import Documents (admin only) ──────────────────────────────
// Mirrors BulkImportDocsModal in Athletes.jsx exactly: one admin-selected
// document type applies to the whole batch (never inferred per-file),
// filenames are used only to extract the QID prefix (extractQidFromFilename,
// shared with the Athlete importer), and files are classified into
// matched/unmatched/ambiguous/duplicate before anything is written.
// Employee-specific differences: QID matching uses normalizeQid (spaces,
// hyphens, Arabic/Western digits) against employees.id_number, and shared
// document types (Photo/Qatar ID/Original Passport) are written to
// person_shared_documents via the employee's person_id — the same table
// PersonDocuments.jsx already reads, so the document shows on a linked
// Coach's page automatically with no separate copy ever created.
function BulkImportEmployeeDocsModal({ employees, personDocs, lang, profile, onClose, onDone }) {
  const ar = lang === 'ar'
  const L = (en, arText) => ar ? arText : en

  const [docType, setDocType] = useState(DOC_TYPES[0])
  const [files, setFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState(null)
  const [sharedDocs, setSharedDocs] = useState([])
  const fileInputRef = useRef(null)
  const [dupeActions, setDupeActions] = useState({})

  const isSharedType = SHARED_TYPES.includes(docType)

  // Shared-type duplicate checks need person_shared_documents, which
  // Employees.jsx doesn't hold globally — fetch once for every employee
  // that actually has a linked person_id (the rest can never use shared
  // types anyway; caught below as noPersonLink).
  useEffect(() => {
    const personIds = [...new Set(employees.map(e => e.person_id).filter(Boolean))]
    if (personIds.length === 0) { setSharedDocs([]); return }
    let cancelled = false
    supabase.from('person_shared_documents').select('*').in('person_id', personIds)
      .then(({ data }) => { if (!cancelled) setSharedDocs(data || []) })
    return () => { cancelled = true }
  }, [employees])

  function addFiles(fileList) {
    const arr = Array.from(fileList || [])
    if (arr.length) setFiles(prev => [...prev, ...arr])
  }

  const preview = (() => {
    const matched = [], unmatched = [], ambiguous = [], duplicates = [], noPersonLink = [], invalid = []
    const seenInBatch = new Set()
    for (const file of files) {
      // Invalid File: unsupported format or over the size limit — checked
      // before anything else, same limit as the individual uploader (20MB).
      if (!SUPPORTED_DOC_FILE_TYPES.includes(file.type)) { invalid.push({ file, reason: L('Unsupported file type — PDF, JPG, or PNG only', 'نوع ملف غير مدعوم — PDF أو JPG أو PNG فقط') }); continue }
      if (file.size > MAX_DOC_FILE_SIZE_BYTES) { invalid.push({ file, reason: L('File exceeds the 20MB limit', 'الملف يتجاوز الحد الأقصى 20 ميجابايت') }); continue }
      if (file.size === 0) { invalid.push({ file, reason: L('File is empty or corrupted', 'الملف فارغ أو تالف') }); continue }

      const qid = extractQidFromFilename(file.name)
      if (!qid) { unmatched.push({ file, qid }); continue }
      const qidNorm = normalizeQid(qid)
      const matches = employees.filter(e => e.id_number && normalizeQid(e.id_number) === qidNorm)
      if (matches.length === 0) { unmatched.push({ file, qid }); continue }
      if (matches.length > 1) { ambiguous.push({ file, qid, matches }); continue }
      const employee = matches[0]

      if (isSharedType && !employee.person_id) { noPersonLink.push({ file, qid, employee, docType }); continue }
      const batchKey = `${employee.id}|${docType}|${file.name}|${file.size}`
      const existingDoc = isSharedType
        ? sharedDocs.find(d => d.person_id === employee.person_id && d.type === docType && d.name === file.name && d.file_size === file.size)
        : personDocs.find(d => String(d.person_id) === String(employee.id) && d.person_type === 'employee' && d.type === docType && d.name === file.name && d.file_size === file.size)
      if (existingDoc) { duplicates.push({ file, qid, employee, docType, existingDoc }); continue }
      if (seenInBatch.has(batchKey)) { duplicates.push({ file, qid, employee, docType, existingDoc: null }); continue }
      seenInBatch.add(batchKey)
      matched.push({ file, qid, employee, docType })
    }
    return { matched, unmatched, ambiguous, duplicates, noPersonLink, invalid }
  })()

  function dupeAction(i) { return dupeActions[i] || 'skip' }
  function setAllDupeActions(action) {
    const next = {}
    preview.duplicates.forEach((_, i) => { next[i] = action })
    setDupeActions(next)
  }

  async function uploadOne(employee, file, docType) {
    const isSharedType = SHARED_TYPES.includes(docType)
    const ext = file.name.split('.').pop()
    const path = `employee_${employee.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`
    const { error: upErr } = await supabase.storage.from('athlete-documents').upload(path, file)
    if (upErr) throw upErr
    const { data } = supabase.storage.from('athlete-documents').getPublicUrl(path)
    if (isSharedType) {
      const { error: dbErr } = await supabase.from('person_shared_documents').insert({
        person_id: employee.person_id, name: file.name, type: docType,
        file_url: data.publicUrl, file_path: path, file_size: file.size,
      })
      if (dbErr) throw dbErr
    } else {
      const { error: dbErr } = await supabase.from('person_documents').insert({
        person_id: employee.id, person_type: 'employee',
        name: file.name, type: docType,
        file_url: data.publicUrl, file_path: path, file_size: file.size,
      })
      if (dbErr) throw dbErr
    }
  }

  async function handleImport() {
    const toReplace = preview.duplicates
      .map((d, i) => ({ d, i }))
      .filter(({ d, i }) => dupeAction(i) === 'replace' && d.existingDoc)
    if (preview.matched.length === 0 && toReplace.length === 0) return
    const operationId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,10)}`
    setImporting(true)
    setProgress({ done: 0, total: preview.matched.length + toReplace.length })
    let imported = 0, replaced = 0, failed = 0

    for (const item of preview.matched) {
      try {
        await uploadOne(item.employee, item.file, item.docType)
        imported++
      } catch { failed++ }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    for (const { d } of toReplace) {
      let newPath = null
      try {
        const isSharedType = SHARED_TYPES.includes(d.docType)
        const ext = d.file.name.split('.').pop()
        newPath = `employee_${d.employee.id}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`
        const { error: upErr } = await supabase.storage.from('athlete-documents').upload(newPath, d.file)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('athlete-documents').getPublicUrl(newPath)
        if (isSharedType) {
          const { error: updErr } = await supabase.from('person_shared_documents').update({
            name: d.file.name, file_url: data.publicUrl, file_path: newPath, file_size: d.file.size, uploaded_at: new Date().toISOString(),
          }).eq('person_id', d.existingDoc.person_id).eq('type', d.existingDoc.type).eq('name', d.existingDoc.name)
          if (updErr) { await supabase.storage.from('athlete-documents').remove([newPath]); throw updErr }
        } else {
          const { error: updErr } = await supabase.from('person_documents').update({
            name: d.file.name, file_url: data.publicUrl, file_path: newPath, file_size: d.file.size, uploaded_at: new Date().toISOString(),
          }).eq('id', d.existingDoc.id)
          if (updErr) { await supabase.storage.from('athlete-documents').remove([newPath]); throw updErr }
        }
        if (d.existingDoc.file_path) {
          await supabase.storage.from('athlete-documents').remove([d.existingDoc.file_path])
        }
        replaced++
      } catch { failed++ }
      setProgress(p => ({ ...p, done: p.done + 1 }))
    }

    setImporting(false)
    const skippedDuplicates = preview.duplicates.filter((_, i) => dupeAction(i) !== 'replace').length
    setSummary({
      imported, replaced, failed, skippedDuplicates,
      unmatched: preview.unmatched.length,
      ambiguous: preview.ambiguous.length,
      noPersonLink: preview.noPersonLink.length,
      invalid: preview.invalid.length,
    })
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin')
    if (admins?.length) {
      const nothingHappened = imported === 0 && replaced === 0 && failed === 0
      const succeeded = (imported + replaced) > 0 && failed === 0
      const partial = (imported + replaced) > 0 && failed > 0
      const type = nothingHappened ? 'import_succeeded' : (succeeded || partial ? 'import_succeeded' : 'import_failed')
      const summaryText = nothingHappened
        ? (ar ? 'لم يتم استيراد أي وثائق جديدة لأن جميع الملفات المحددة تم تخطيها.' : 'No new documents were imported because all selected files were skipped.')
        : (ar
            ? `تم استيراد ${imported}، استبدال ${replaced}، تخطي ${skippedDuplicates}، غير مطابق ${preview.unmatched.length}، فشل ${failed}`
            : `Imported ${imported}, replaced ${replaced}, skipped ${skippedDuplicates}, unmatched ${preview.unmatched.length}, failed ${failed}`)
      const { error: notifErr } = await supabase.from('notifications').insert(admins.map(a => ({
        user_id: a.id,
        type,
        title: nothingHappened
          ? (ar ? 'اكتمل الاستيراد — لا جديد' : 'Import completed — nothing new')
          : succeeded
            ? (ar ? 'اكتمل استيراد الوثائق' : 'Document import completed')
            : partial
              ? (ar ? 'اكتمل استيراد الوثائق جزئياً' : 'Document import completed with errors')
              : (ar ? 'فشل استيراد الوثائق' : 'Document import failed'),
        body: summaryText,
        data: { page: 'employees' },
        read: false,
        category: 'Documents', target_path: 'employees', related_entity_type: 'import_batch', related_entity_id: operationId,
        dedup_key: `doc-import-${type === 'import_failed' ? 'failed' : 'succeeded'}-${operationId}-${a.id}`,
      })))
      if (notifErr) console.error('[notifications] failed to insert import result notification:', notifErr)
    }
    await supabase.from('activity_log').insert({
      actor_id: profile?.id || null,
      actor_name: profile?.full_name || profile?.email || 'Someone',
      actor_email: (profile?.email || '').toLowerCase() || null,
      action: failed > 0 && (imported + replaced) === 0 ? 'import_failed' : 'import_succeeded',
      entity_type: 'import',
      entity_id: operationId,
      entity_label: `${imported} imported, ${replaced} replaced, ${failed} failed`,
      module: 'employees',
      metadata: { imported, replaced, failed, skipped: skippedDuplicates, unmatched: preview.unmatched.length, noPersonLink: preview.noPersonLink.length },
    })
    // Deliberately NOT calling onDone() here — refresh waits until the
    // user explicitly dismisses the completion screen via Close/X.
  }

  async function handleClose() {
    if (summary) await onDone()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={() => !importing && !summary && onClose()}>
      <div className="modal-box" style={{ width: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{L('Upload Documents', 'رفع مستندات')}</div>
          <button className="modal-close" onClick={() => !importing && handleClose()}><i className="ti ti-x" /></button>
        </div>

        <div className="modal-body">
          {summary ? (
            <ImportCompletionSummary summary={summary} L={L} />
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">{L('Document Type', 'نوع الوثيقة')}</label>
                <select className="form-input" value={docType} onChange={e => setDocType(e.target.value)} disabled={importing}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{ar ? (DOC_TYPES_AR[t] || t) : t}</option>)}
                </select>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                  {L('All imported files will be saved as this document type, regardless of filename.', 'سيتم حفظ جميع الملفات المستوردة بهذا النوع من الوثائق، بغض النظر عن اسم الملف.')}
                </div>
              </div>

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? '#0085C7' : 'var(--border)'}`,
                  borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                  background: dragOver ? 'rgba(0,133,199,.05)' : 'var(--surface2)', marginBottom: 16, marginTop: 12,
                }}>
                <i className="ti ti-upload" style={{ fontSize: 26, color: 'var(--text3)' }} />
                <div style={{ fontSize: 13, marginTop: 8 }}>{L('Click or drag files here', 'انقر أو اسحب الملفات هنا')}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{L('Filenames must start with the employee Qatar ID, e.g. 28163400725_id.pdf', 'يجب أن يبدأ اسم الملف بالرقم الشخصي للموظف، مثال: 28163400725_id.pdf')}</div>
                <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
              </div>

              {files.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
                  {files.length} {L('file(s) selected', 'ملف تم اختياره')} — {preview.matched.length} {L('matched', 'مطابق')}, {preview.unmatched.length} {L('unmatched', 'غير مطابق')}, {preview.ambiguous.length} {L('ambiguous', 'غير مؤكد')}, {preview.duplicates.length} {L('duplicates', 'مكرر')}, {preview.noPersonLink.length} {L('no linked person', 'بدون سجل مرتبط')}
                </div>
              )}

              {importing && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ height: 8, background: 'var(--surface2)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`, background: '#0085C7', transition: 'width .2s' }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>{progress.done} / {progress.total} {L('uploaded', 'تم الرفع')}</div>
                </div>
              )}

              {files.length > 0 && (
                <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {preview.matched.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#00875a', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('Matched', 'مطابق')} ({preview.matched.length})</div>
                      {preview.matched.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.file.name}</span>
                          <span style={{ color: 'var(--text2)' }}>{ar && m.employee.name_ar ? m.employee.name_ar : m.employee.name}</span>
                          <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid}</span>
                          <span className="badge badge-green" style={{ fontSize: 10 }}>{ar ? (DOC_TYPES_AR[docType] || docType) : docType}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.unmatched.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('Unmatched', 'غير مطابق')} ({preview.unmatched.length})</div>
                      {preview.unmatched.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.file.name}</span>
                          <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.ambiguous.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('Ambiguous matches', 'تطابقات غير مؤكدة')} ({preview.ambiguous.length})</div>
                      {preview.ambiguous.map((m, i) => (
                        <div key={i} style={{ padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.file.name}</span>
                            <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid}</span>
                          </div>
                          <div style={{ color: 'var(--text3)', marginTop: 2 }}>{m.matches.length} {L('employees share this Qatar ID', 'موظفون يشتركون في هذا الرقم')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.noPersonLink.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('No linked person record', 'بدون سجل شخصي مرتبط')} ({preview.noPersonLink.length})</div>
                      {preview.noPersonLink.map((m, i) => (
                        <div key={i} style={{ padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.file.name}</span>
                            <span style={{ color: 'var(--text2)' }}>{ar && m.employee.name_ar ? m.employee.name_ar : m.employee.name}</span>
                          </div>
                          <div style={{ color: 'var(--text3)', marginTop: 2 }}>{L(`${docType} is a shared document type but this employee has no linked person record yet.`, `${ar ? (DOC_TYPES_AR[docType]||docType) : docType} من الوثائق المشتركة ولكن لا يوجد سجل شخصي مرتبط بهذا الموظف بعد.`)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.invalid.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>{L('Invalid file', 'ملف غير صالح')} ({preview.invalid.length})</div>
                      {preview.invalid.map((m, i) => (
                        <div key={i} style={{ padding: '8px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.file.name}</div>
                          <div style={{ color: '#dc2626', marginTop: 2 }}>{m.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {preview.duplicates.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{L('Duplicates', 'مكرر')} ({preview.duplicates.length})</div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button type="button" onClick={() => setAllDupeActions('skip')} disabled={importing}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer' }}>
                            {L('Skip All Duplicates', 'تخطي كل المكررات')}
                          </button>
                          <button type="button" onClick={() => setAllDupeActions('replace')} disabled={importing}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid #0085C7', background: 'rgba(0,133,199,.08)', color: '#0085C7', cursor: 'pointer' }}>
                            {L('Replace All Duplicates', 'استبدال كل المكررات')}
                          </button>
                        </div>
                      </div>
                      {preview.duplicates.map((m, i) => {
                        const action = dupeAction(i)
                        const canReplace = !!m.existingDoc
                        return (
                          <div key={i} style={{ padding: '10px 10px', background: 'var(--surface2)', borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontWeight: 500 }}>{m.file.name}</span>
                              <span style={{ color: 'var(--text2)' }}>{ar && m.employee?.name_ar ? m.employee.name_ar : m.employee?.name}</span>
                              <span style={{ color: 'var(--text3)', fontFamily: 'monospace' }}>{m.qid}</span>
                              <span className="badge badge-blue" style={{ fontSize: 10 }}>{ar ? (DOC_TYPES_AR[docType] || docType) : docType}</span>
                            </div>
                            {m.existingDoc && (
                              <div style={{ color: 'var(--text3)', marginBottom: 6 }}>
                                {L('Existing', 'الحالي')}: {m.existingDoc.name} — {m.existingDoc.uploaded_at ? new Date(m.existingDoc.uploaded_at).toLocaleDateString() : '—'}
                              </div>
                            )}
                            {!canReplace && (
                              <div style={{ color: 'var(--text3)', marginBottom: 6 }}>
                                {L('Duplicate within this batch — only the first occurrence can be imported.', 'مكرر ضمن هذه الدفعة — يمكن استيراد النسخة الأولى فقط.')}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" disabled={importing} onClick={() => setDupeActions(prev => ({ ...prev, [i]: 'skip' }))}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                                  border: `1px solid ${action === 'skip' ? 'var(--text3)' : 'var(--border)'}`,
                                  background: action === 'skip' ? 'var(--surface)' : 'transparent',
                                  color: action === 'skip' ? 'var(--text)' : 'var(--text3)', fontWeight: action === 'skip' ? 600 : 400 }}>
                                {L('Skip', 'تخطي')}
                              </button>
                              <button type="button" disabled={importing || !canReplace} onClick={() => canReplace && setDupeActions(prev => ({ ...prev, [i]: 'replace' }))}
                                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: canReplace ? 'pointer' : 'not-allowed',
                                  border: `1px solid ${action === 'replace' ? '#0085C7' : 'var(--border)'}`,
                                  background: action === 'replace' ? 'rgba(0,133,199,.1)' : 'transparent',
                                  color: action === 'replace' ? '#0085C7' : 'var(--text3)', fontWeight: action === 'replace' ? 600 : 400,
                                  opacity: canReplace ? 1 : .5 }}>
                                {L('Replace', 'استبدال')}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          {summary ? (
            <button className="btn btn-blue" onClick={handleClose}>{L('Close', 'إغلاق')}</button>
          ) : (
            <>
              <button className="btn-cancel" onClick={onClose} disabled={importing}>{L('Cancel', 'إلغاء')}</button>
              {(() => {
                const replaceCount = preview.duplicates.filter((_, i) => dupeAction(i) === 'replace' && preview.duplicates[i].existingDoc).length
                const totalActionable = preview.matched.length + replaceCount
                return (
                  <button className="btn btn-blue" disabled={importing || totalActionable === 0} onClick={handleImport}>
                    {importing ? L('Uploading…', 'جارٍ الرفع…') : `${L('Upload', 'رفع')} (${totalActionable})`}
                  </button>
                )
              })()}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Employees({ employees, coaches, personDocs, onRefresh, onNav, initEmployeeId, navState, profile, isMyProfile }) {
  const [customDesignations, setCustomDesignations] = useState([])
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('employee_designations').select('label, label_ar').order('label')
      if (data) setCustomDesignations(data)
    })()
  }, [])
  const { tx, tc, lang } = useLang()
  const [search, setSearch]         = useState('')
  const [sort, setSort]             = useState('name-asc')
  const [colFilters, setColFilters] = useState({})
  const [selected, setSelected]     = useState(initEmployeeId || null)
  // Top-level (unconditional) — must not live inside the `if (selected)`
  // branch below, since that would violate the Rules of Hooks (list view
  // vs detail view would execute a different number of hooks).
  const selectedEmpForRoles = employees.find(x => x.id === selected)
  const { roles: personRoles } = usePersonRoles(selectedEmpForRoles?.person_id)
  const [confirm, setConfirm]       = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [editForm, setEditForm]     = useState(null)
  const [pendingStatusSave, setPendingStatusSave] = useState(null) // { formData, isEdit } awaiting scope confirmation
  const [addModal, setAddModal]     = useState(false)
  const [bulkDocsOpen, setBulkDocsOpen] = useState(false)
  const photoInput = useRef(null)
  const [cropFile, setCropFile] = useState(null) // { empId, file } pending crop
  const [hoveredRowId, setHoveredRowId] = useState(null)

  // Column selection — same pattern as Athletes.jsx: localStorage-persisted,
  // Name column always included and locked.
  const DEFAULT_EMPLOYEE_COLS = ['name','designation','nationality','gender','employee_number','qss_number','status']
  const EMP_COLS_STORAGE_KEY = 'qpc_employees_visible_cols_v1'
  // Coach/Employee viewers get a fixed, non-configurable column set that
  // deliberately excludes the employee's name (a private field per the
  // directory read-only view spec) — unlike the admin default, 'name' is
  // NOT force-included here.
  const restrictedView = profile?.role === 'coach' || profile?.role === 'employee'
  const RESTRICTED_COLS = ['name', 'designation', 'designation_ar', 'status', 'nationality', 'gender']
  function loadStoredEmpCols(fallback) {
    if (restrictedView) return RESTRICTED_COLS
    try {
      const raw = localStorage.getItem(EMP_COLS_STORAGE_KEY)
      if (!raw) return fallback
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length === 0) return fallback
      if (!parsed.every(k => typeof k === 'string')) return fallback
      return parsed.includes('name') ? parsed : ['name', ...parsed]
    } catch {
      return fallback
    }
  }
  const [visibleCols, setVisibleColsRaw] = useState(loadStoredEmpCols(DEFAULT_EMPLOYEE_COLS))
  function setVisibleCols(next) {
    if (restrictedView) return // column set is fixed for Coach/Employee — no picker, no override
    setVisibleColsRaw(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      try { localStorage.setItem(EMP_COLS_STORAGE_KEY, JSON.stringify(resolved)) } catch {}
      return resolved
    })
  }
  const [colPickerOpen, setColPickerOpen] = useState(false)
  const colPickerRef = useRef(null)
  useEffect(() => {
    if (!colPickerOpen) return
    function onClickOutside(e) { if (colPickerRef.current && !colPickerRef.current.contains(e.target)) setColPickerOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [colPickerOpen])

  useEffect(() => { if (initEmployeeId) setSelected(initEmployeeId) }, [initEmployeeId])

  // Same reasoning as Athletes.jsx/Coaches.jsx: a caller-provided
  // initEmployeeId (e.g. this page reused for "My Profile") must always win
  // over a generic reset.
  useEffect(() => {
    if (navState?.reset && initEmployeeId == null) {
      setSelected(null); setSearch(''); setSort('name-asc'); setColFilters({})
    }
  }, [navState, initEmployeeId])

  const hasFilters = search || Object.values(colFilters).some(v => v && v !== 'All')
  const DESIG_LABELS = lang === 'ar' ? {
    'All designations':'جميع المسميات', 'All':'الكل',
    'Coach':'مدرب', 'Assistant Coach':'مدرب مساعد',
    'Technical Expert':'خبير تقني', 'Physiotherapist':'معالج فيزيائي',
    'Doctor':'طبيب', 'Secretary General':'الأمين العام',
    'Executive Manager':'مدير تنفيذي',
    'Administration Secretary':'سكرتير إداري',
    'Secretary Assistant':'مساعد سكرتير',
    'Administrative National Team':'إداري الفريق الوطني',
    'Administrative Youth Team':'إداري فريق الشباب',
    'Administrative Center & Development':'إداري المركز والتطوير',
    'Accountant':'محاسب', 'Public Relation Officer':'مسؤول علاقات عامة',
    'Receptionist':'موظف استقبال', 'Board Member':'عضو مجلس إدارة',
    'Official':'مسؤول', 'Delegate':'مندوب', 'Employee':'موظف',
    'Store Keeper':'أمين مخزن', 'Waiter':'نادل',
    'Worker':'عامل', 'Driver':'سائق',
  } : {
    'All designations':'All designations', 'All':'All',
    'Coach':'Coach', 'Assistant Coach':'Assistant Coach',
    'Technical Expert':'Technical Expert', 'Physiotherapist':'Physiotherapist',
    'Doctor':'Doctor', 'Secretary General':'Secretary General',
    'Executive Manager':'Executive Manager',
    'Administration Secretary':'Administration Secretary',
    'Secretary Assistant':'Secretary Assistant',
    'Administrative National Team':'Administrative National Team',
    'Administrative Youth Team':'Administrative Youth Team',
    'Administrative Center & Development':'Administrative Center & Development',
    'Accountant':'Accountant', 'Public Relation Officer':'Public Relation Officer',
    'Receptionist':'Receptionist', 'Board Member':'Board Member',
    'Official':'Official', 'Delegate':'Delegate', 'Employee':'Employee',
    'Store Keeper':'Store Keeper', 'Waiter':'Waiter',
    'Worker':'Worker', 'Driver':'Driver',
  }

  const COL_FILTERS = {
    designation: [...new Set(employees.map(e => e.designation).filter(Boolean))].sort(),
    nationality: [...new Set(employees.map(e => e.nationality).filter(Boolean))].sort(),
    gender:      ['Male','Female'],
    status:      ['Active','On Leave','In Competition','In Training Camp','When needed','External','Inactive','Retired'],
    // Built from whatever values actually exist, so new values (beyond
    // "Yes") added later automatically become filterable with no code change.
    adel_certificate: [...new Set(employees.map(e => e.adel_certificate).filter(Boolean))].sort(),
  }
  const COL_FILTER_LABELS = {
    gender: { 'Male':tx('form.male','Male'), 'Female':tx('form.female','Female') },
    status: { 'Active':tx('status.active','Active'), 'On Leave':tx('status.onLeave','On Leave'), 'In Competition': lang==='ar' ? 'في منافسة' : 'In Competition', 'In Training Camp': lang==='ar' ? 'في معسكر تدريبي' : 'In Training Camp', 'When needed': lang==='ar' ? 'عند الحاجة' : 'When needed', 'External': lang==='ar' ? 'خارجي' : 'External', 'Inactive':tx('status.inactive','Inactive'), 'Retired': lang==='ar' ? 'متقاعد' : 'Retired' },
    adel_certificate: { 'Yes': lang==='ar' ? 'نعم' : 'Yes' },
  }

  const ALL_COLS = [
    { key:'name',              label:tx('employees.employee','Staff Member') },
    { key:'employee_number',   label:tx('employees.employeeNum','Staff Number') },
    { key:'qss_number',        label:tx('employees.qssNum','QSS #') },
    { key:'job_id',            label:tx('employees.jobId','Job ID') },
    { key:'designation',       label:tx('employees.designation','Designation') },
    { key:'designation_ar',    label:tx('employees.arabicDesignation','Arabic Designation') },
    { key:'status',            label:tx('employees.status','Status') },
    { key:'nationality',       label:tx('employees.nationality','Nationality') },
    { key:'gender',            label:tx('employees.gender','Gender') },
    { key:'phone',             label:tx('employees.phone','Phone') },
    { key:'email',             label:tx('employees.email','Email') },
    { key:'dob',               label:tx('employees.dob','Date of Birth') },
    { key:'id_number',         label:tx('employees.idNumber','Qatar ID') },
    { key:'id_expiry',         label:tx('employees.idExpiry','ID Expiry') },
    { key:'passport_number',   label:tx('employees.passportNumber','Passport No') },
    { key:'passport_expiry',   label:tx('employees.passportExpiry','Passport Expiry') },
    { key:'adel_certificate',  label:tx('employees.adelCertificate','ADEL Certificate') },
  ]
  function toggleCol(key) {
    if (key === 'name') return // always visible
    setVisibleCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }
  const isVisible = key => visibleCols.includes(key)
  // Fixed width for the sticky Employee column so its sticky offset never
  // shifts based on content length (matches Athletes.jsx exactly).
  const STICKY_NAME_COL_WIDTH = 220

  function matchMulti(selectedValues, fieldValue) {
    if (!selectedValues || selectedValues.length === 0) return true
    return selectedValues.some(v => v === 'Blank' ? !fieldValue : fieldValue === v)
  }

  // Shared predicate, reused by both the main list and per-option counts —
  // skipColKey excludes one column's own filter so opening its dropdown
  // shows counts under every OTHER active filter (search + other columns).
  function passesEmployeeFilters(e, q, skipColKey) {
    const skip = (key) => key === skipColKey
    return (
      (!q || matchesSearch(buildSearchText(
        e.name, e.name_ar, e.designation, e.designation_ar,
        e.employee_number, e.qss_number, e.job_id, e.id_number,
        e.passport_number, e.nationality, e.gender,
        effectiveStatus(employeeStatusSource(e, coaches)), e.phone, e.email,
        e.dob, e.id_expiry, e.passport_expiry, e.adel_certificate,
      ), q)) &&
      (skip('designation') || matchMulti(colFilters.designation, e.designation)) &&
      (skip('nationality') || matchMulti(colFilters.nationality, e.nationality)) &&
      (skip('gender') || matchMulti(colFilters.gender, e.gender)) &&
      (skip('status') || !colFilters.status?.length || colFilters.status.includes(effectiveStatus(employeeStatusSource(e, coaches)))) &&
      (skip('adel_certificate') || matchMulti(colFilters.adel_certificate, e.adel_certificate))
    )
  }

  function computeEmployeeOptionCounts(colKey, getFieldValue, matchOption) {
    const q = search
    const base = employees.filter(e => passesEmployeeFilters(e, q, colKey))
    return (value) => base.filter(e => matchOption(getFieldValue(e), value)).length
  }

  let list = employees.filter(e => passesEmployeeFilters(e, search, null))
  list = [...list].sort((a, b) => {
    if (sort === 'name-asc')   return a.name.localeCompare(b.name)
    if (sort === 'name-desc')  return b.name.localeCompare(a.name)
    if (sort === 'designation-asc')  return (a.designation||'').localeCompare(b.designation||'')
    if (sort === 'designation-desc') return (b.designation||'').localeCompare(a.designation||'')
    if (sort === 'nationality-asc')    return (a.nationality||'').localeCompare(b.nationality||'')
    if (sort === 'nationality-desc')   return (b.nationality||'').localeCompare(a.nationality||'')
    if (sort === 'gender-asc')   return (a.gender||'').localeCompare(b.gender||'')
    if (sort === 'gender-desc')  return (b.gender||'').localeCompare(a.gender||'')
    if (sort === 'employee_number-asc')      return (a.employee_number||'').localeCompare(b.employee_number||'')
    if (sort === 'employee_number-desc')     return (b.employee_number||'').localeCompare(a.employee_number||'')
    if (sort === 'qss_number-asc')      return (a.qss_number||'').localeCompare(b.qss_number||'')
    if (sort === 'qss_number-desc')     return (b.qss_number||'').localeCompare(a.qss_number||'')
    if (sort === 'status-asc')   return (effectiveStatus(employeeStatusSource(a, coaches))||'').localeCompare(effectiveStatus(employeeStatusSource(b, coaches))||'')
    if (sort === 'status-desc')  return (effectiveStatus(employeeStatusSource(b, coaches))||'').localeCompare(effectiveStatus(employeeStatusSource(a, coaches))||'')
    if (sort === 'job_id-asc')           return (a.job_id||'').localeCompare(b.job_id||'')
    if (sort === 'job_id-desc')          return (b.job_id||'').localeCompare(a.job_id||'')
    if (sort === 'designation_ar-asc')   return (a.designation_ar||'').localeCompare(b.designation_ar||'')
    if (sort === 'designation_ar-desc')  return (b.designation_ar||'').localeCompare(a.designation_ar||'')
    if (sort === 'phone-asc')            return (a.phone||'').localeCompare(b.phone||'')
    if (sort === 'phone-desc')           return (b.phone||'').localeCompare(a.phone||'')
    if (sort === 'email-asc')            return (a.email||'').localeCompare(b.email||'')
    if (sort === 'email-desc')           return (b.email||'').localeCompare(a.email||'')
    if (sort === 'dob-asc')              return (a.dob||'').localeCompare(b.dob||'')
    if (sort === 'dob-desc')             return (b.dob||'').localeCompare(a.dob||'')
    if (sort === 'id_number-asc')        return (a.id_number||'').localeCompare(b.id_number||'')
    if (sort === 'id_number-desc')       return (b.id_number||'').localeCompare(a.id_number||'')
    if (sort === 'id_expiry-asc')        return (a.id_expiry||'').localeCompare(b.id_expiry||'')
    if (sort === 'id_expiry-desc')       return (b.id_expiry||'').localeCompare(a.id_expiry||'')
    if (sort === 'passport_number-asc')  return (a.passport_number||'').localeCompare(b.passport_number||'')
    if (sort === 'passport_number-desc') return (b.passport_number||'').localeCompare(a.passport_number||'')
    if (sort === 'passport_expiry-asc')  return (a.passport_expiry||'').localeCompare(b.passport_expiry||'')
    if (sort === 'passport_expiry-desc') return (b.passport_expiry||'').localeCompare(a.passport_expiry||'')
    if (sort === 'adel_certificate-asc')  return (a.adel_certificate||'').localeCompare(b.adel_certificate||'')
    if (sort === 'adel_certificate-desc') return (b.adel_certificate||'').localeCompare(a.adel_certificate||'')
    return 0
  })

  // Same safe matching priority as the delete_coach_and_employee RPC —
  // used here only to decide which confirmation message to show, never to
  // delete anything directly (the RPC re-resolves and verifies server-side).
  function findLinkedCoach(emp) {
    const byIdentifier = coaches.find(c =>
      (emp.person_id && c.person_id === emp.person_id) ||
      (emp.qss_number && c.qss_number === emp.qss_number) ||
      (emp.employee_number && c.employee_number === emp.employee_number) ||
      (emp.id_number && c.id_number === emp.id_number)
    )
    if (byIdentifier) return { coach: byIdentifier, byName: false }
    // Reviewed fallback: only reached when the employee has literally no
    // QSS number, employee number, Qatar ID, or person_id to match on
    // (e.g. a record created with just a name + designation). Matched by
    // exact normalized name only, and always surfaced to the user for
    // explicit confirmation — never auto-deleted silently.
    const nameMatch = !emp.qss_number && !emp.employee_number && !emp.id_number && !emp.person_id
      ? coaches.find(c => c.name && emp.name && c.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
      : null
    return nameMatch ? { coach: nameMatch, byName: true } : null
  }

  async function handleDelete(id, name, linkedCoachId) {
    const { data, error } = await supabase.rpc('delete_coach_and_employee', { p_employee_id: id, p_coach_id: linkedCoachId || null })
    if (error) { toast(error.message, 'error'); return }
    toast(data?.coach_deleted ? `${name} (Employee + Coach) deleted` : `${name} deleted`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: 'deleted', entityType: 'employee', entityId: id, entityLabel: name, module: 'employees' })
      if (data?.coach_deleted) {
        logAdminActivity({ actor: profile, action: 'deleted', entityType: 'coach', entityId: data.coach_id, entityLabel: data.coach_name || name, module: 'coaches' })
      }
    }
    setSelected(null); setConfirm(null); onRefresh()
  }

  async function handleSave(formData, isEdit) {
    const DATE_STATUSES = ['On Leave', 'In Competition', 'In Training Camp']
    const finalStatus = formData.status || 'Active'
    const isDatedStatus = DATE_STATUSES.includes(finalStatus)
    const payload = {
      name: formData.name, name_ar: formData.name_ar || null,
      gender: formData.gender || null, nationality: formData.nationality || null,
      designation: formData.designation || null, designation_ar: formData.designation_ar || null,
      employee_number: formData.employee_number || null, qss_number: formData.qss_number || null, job_id: formData.job_id || null,
      phone: formData.phone || null, email: formData.email || null,
      status: finalStatus,
      status_start: isDatedStatus ? (formData.status_start||null) : null,
      status_end:   isDatedStatus ? (formData.status_end||null)   : null,
      notes: formData.notes || null,
      dob: formData.dob || null,
      id_number: formData.id_number || null,
      id_expiry: formData.id_expiry || null,
      passport_number: formData.passport_number || null,
      passport_expiry: formData.passport_expiry || null,
      adel_certificate: (formData.adel_certificate || '').replace(/[^\p{L}\p{N}\s]/gu, '').trim() || null,
    }
    if (!payload.name) { toast('Name is required', 'error'); return }

    // If this is an edit that changes status, and the person has more than
    // one linked role, defer to the scope-confirmation modal instead of
    // silently writing the new status — never auto-synchronize across roles.
    if (isEdit) {
      const existing = employees.find(e => e.id === formData.id)
      if (existing && existing.status !== finalStatus && existing.person_id) {
        const [aRes, cRes, eRes, rRes] = await Promise.all([
          supabase.from('athletes').select('id, status, is_historical').eq('person_id', existing.person_id),
          supabase.from('coaches').select('id, status, is_historical').eq('person_id', existing.person_id),
          supabase.from('employees').select('id, status, is_historical').eq('person_id', existing.person_id),
          supabase.from('referees').select('id, is_historical').eq('person_id', existing.person_id),
        ])
        const linkedRoles = []
        ;(aRes.data||[]).forEach(x => linkedRoles.push({ type:'athlete', id:x.id, is_historical: !!x.is_historical }))
        ;(cRes.data||[]).forEach(x => linkedRoles.push({ type:'coach', id:x.id, is_historical: !!x.is_historical }))
        ;(eRes.data||[]).forEach(x => linkedRoles.push({ type:'employee', id:x.id, is_historical: !!x.is_historical }))
        ;(rRes.data||[]).forEach(x => linkedRoles.push({ type:'referee', id:x.id, is_historical: !!x.is_historical }))
        if (linkedRoles.length > 1) {
          setPendingStatusSave({ formData, isEdit, payload, roles: linkedRoles, newStatus: finalStatus })
          return
        }
      }
    }

    await commitSave(formData, isEdit, payload)
  }

  async function commitSave(formData, isEdit, payload) {
    const { error } = isEdit
      ? await supabase.from('employees').update(payload).eq('id', formData.id)
      : await supabase.from('employees').insert(payload)
    if (error) { toast(error.message, 'error'); return }

    // employeeStatusSource() (used everywhere this app decides what status a
    // coach-type employee shows) reads the linked coaches row by
    // qss_number/name — not person_id. So for the new status/designation to
    // actually be reflected there (and on the Coaches list itself), that
    // same row must be updated directly whenever one exists, regardless of
    // whether the person also happens to have a shared person_id link.
    if (COACH_DESIGNATIONS.includes(payload.designation) && coaches?.length) {
      const coachRec = coaches.find(c =>
        (payload.qss_number && c.qss_number && c.qss_number === payload.qss_number) ||
        (payload.name && c.name && c.name.trim().toLowerCase() === payload.name.trim().toLowerCase())
      )
      if (coachRec) {
        const coachSets = {}
        if (coachRec.status !== payload.status) {
          coachSets.status = payload.status
          coachSets.status_start = payload.status_start
          coachSets.status_end = payload.status_end
        }
        if (coachRec.designation !== payload.designation) coachSets.designation = payload.designation
        if (coachRec.designation_ar !== payload.designation_ar) coachSets.designation_ar = payload.designation_ar
        if (Object.keys(coachSets).length) await supabase.from('coaches').update(coachSets).eq('id', coachRec.id)
      } else if (['Coach', 'Assistant Coach'].includes(payload.designation)) {
        // No linked Coach record yet for a Coach/Assistant Coach employee —
        // create one, reusing this employee's own data rather than
        // duplicating a new person.
        await supabase.from('coaches').insert({
          name: payload.name, name_ar: payload.name_ar, gender: payload.gender, nationality: payload.nationality,
          designation: payload.designation, designation_ar: payload.designation_ar,
          qss_number: payload.qss_number, employee_number: payload.employee_number,
          phone: payload.phone, email: payload.email, status: payload.status,
          status_start: payload.status_start, status_end: payload.status_end,
        })
      }
    }

    toast(isEdit ? `${payload.name} updated` : `${payload.name} added`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: isEdit ? 'updated' : 'created', entityType: 'employee', entityId: formData.id || null, entityLabel: payload.name, module: 'employees' })
    }
    setEditForm(null); setAddModal(false)
    await onRefresh()
    if (isEdit) setSelected(formData.id)
  }
  // Applies the confirmed status/date fields to whichever role types the
  // admin selected in the scope modal — the employee row (this page's own
  // role) always goes through commitSave's normal payload; any additional
  // selected role types get only their status/date fields updated directly,
  // never their unrelated role-specific data.
  async function applyStatusToRoles(selectedTypes, pending) {
    const { formData, isEdit, payload, roles } = pending
    if (selectedTypes.includes('employee')) {
      await commitSave(formData, isEdit, payload)
    }
    const statusFields = { status: payload.status, status_start: payload.status_start, status_end: payload.status_end }
    for (const type of selectedTypes) {
      if (type === 'employee') continue
      const role = roles.find(r => r.type === type)
      if (!role) continue
      if (type === 'referee') continue // referees have no status field
      await supabase.from(type === 'athlete' ? 'athletes' : 'coaches').update(statusFields).eq('id', role.id)
    }
    setPendingStatusSave(null)
    await onRefresh()
  }

  async function handlePhotoUpload(empId, file) {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB', 'error'); return }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `emp_${empId}.${ext}`
      const { error: upErr } = await supabase.storage.from('coach-photos').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('coach-photos').getPublicUrl(path)
      const newPhotoUrl = data.publicUrl + '?t=' + Date.now()
      await supabase.from('employees').update({ photo_url: newPhotoUrl }).eq('id', empId)

      // Keep the linked Coach record's photo in sync too, if it doesn't
      // already have its own (never overwrite a photo a coach set directly).
      const emp = employees.find(e => e.id === empId)
      if (emp && COACH_DESIGNATIONS.includes(emp.designation) && coaches?.length) {
        const coachRec = coaches.find(c =>
          (emp.qss_number && c.qss_number && c.qss_number === emp.qss_number) ||
          (emp.name && c.name && c.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
        )
        if (coachRec && !coachRec.photo_url) {
          await supabase.from('coaches').update({ photo_url: newPhotoUrl }).eq('id', coachRec.id)
        }
      }

      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  // ── DETAIL VIEW ──
  if (selected) {
    const emp = employees.find(x => x.id === selected)
    if (!emp) { setSelected(null); return null }
    // Coach-type employees → always redirect to Coaches detail page,
    // tagging where we came from so its Back button returns here.
    if (COACH_DESIGNATIONS.includes(emp.designation) && coaches?.length) {
      const coach = coaches.find(c =>
        c.status !== 'Inactive' && (
          (emp.qss_number && c.qss_number && c.qss_number === emp.qss_number) ||
          (emp.name && c.name && c.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
        )
      )
      if (coach) { onNav('coaches', { coachId: coach.id, returnTo: 'employees' }); return null }
    }
    const color = DESIG_COLORS[emp.designation] || '#9aa3b2'
    const yearsOfService = (() => {
      if (!emp.created_at) return null
      const start = new Date(emp.created_at)
      const now = new Date()
      const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
      if (months < 12) return lang==='ar' ? `${months} شهر` : `${months} mo`
      const y = Math.floor(months / 12), m = months % 12
      return m > 0 ? `${y}y ${m}mo` : (lang==='ar' ? `${y} سنة` : `${y} yr${y!==1?'s':''}`)
    })()
    return (
      <div>
        {editForm && <EmpModal data={editForm} isEdit={true} onClose={() => setEditForm(null)} onSave={handleSave} employees={employees} customDesignations={customDesignations} onDesignationAdded={d => setCustomDesignations(p => [...p, d])} />}
        {pendingStatusSave && (
          <StatusScopeModal
            roles={pendingStatusSave.roles}
            currentRoleType="employee"
            lang={lang}
            onConfirm={(types) => applyStatusToRoles(types, pendingStatusSave)}
            onCancel={() => setPendingStatusSave(null)}
          />
        )}
        {confirm && (() => {
          const linked = findLinkedCoach(emp)
          const message = linked
            ? (lang==='ar'
                ? 'هذا الشخص مسجل كمدرب وموظف. سيؤدي الحذف إلى إزالة السجلين. هل تريد المتابعة؟'
                : 'This person exists as both a Coach and an Employee. Deleting will remove both records. Continue?')
            : `Delete ${emp.name}?`
          return (
            <ConfirmModal title="Delete employee" message={message}
              onConfirm={() => handleDelete(emp.id, emp.name, linked?.coach?.id)} onCancel={() => setConfirm(null)} />
          )
        })()}
        <button className="back-btn" onClick={() => setSelected(null)}><i className="ti ti-arrow-left" /> {tx('actions.back','Back')}</button>
        <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
          {canEdit(profile) && (
            <button className="action-btn action-btn-edit" onClick={() => setEditForm({ ...emp })}><i className="ti ti-pencil" /> {tx('actions.edit','Edit')}</button>
          )}
          {/* Delete is only available from the Employees management page —
              viewing your own record via My Profile never shows it, since
              deleting yourself from there makes no sense. */}
          {canEdit(profile) && !isMyProfile && (
            <button className="action-btn action-btn-delete" onClick={() => setConfirm(true)}><i className="ti ti-trash" /> {tx('actions.delete','Delete')}</button>
          )}
          <button className="action-btn action-btn-edit"
            style={{ borderColor:'#009F6B', color:'#009F6B' }}
            onMouseEnter={e => e.currentTarget.style.background='#e6f4ee'}
            onMouseLeave={e => e.currentTarget.style.background=''}
            onClick={() => exportEmployeesPDF(emp, lang, coaches)}>
            <i className="ti ti-printer" /> {tx('actions.exportPDF','Export PDF')}
          </button>
          <EmployeeCardButton emp={emp} />
        </div>

        {/* Matches the Athletes profile structure: left profile card in its
            own column, right column stacks Employee Information → Notes →
            Documents → Career History, all at the same width — nothing
            breaks out to full width. */}
        <div className="detail-grid">
          <div className="detail-profile">
            <div style={{ position:'relative', width:90, height:90, margin:'0 auto 14px' }}>
              {emp.photo_url
                ? <img src={emp.photo_url} alt={emp.name} style={{ width:90, height:90, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--border)' }} />
                : <div style={{ width:90, height:90, borderRadius:'50%', background:color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:600, color:'#fff' }}>{initials(emp.name)}</div>
              }
              {canEdit(profile) && (
                <div style={{ position:'absolute', bottom:0, right:0, display:'flex', gap:3 }}>
                  <button onClick={() => photoInput.current.click()} disabled={uploading} title="Upload photo"
                    style={{ width:26, height:26, borderRadius:'50%', background:color, border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                    {uploading ? <div style={{ width:10, height:10, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }} /> : <i className="ti ti-camera" style={{ fontSize:12 }} />}
                  </button>
                  {emp.photo_url && (
                    <button onClick={async () => { await supabase.from('employees').update({ photo_url:null }).eq('id', emp.id); await onRefresh() }}
                      style={{ width:26, height:26, borderRadius:'50%', background:'#dc2626', border:'2px solid #fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
                      <i className="ti ti-x" style={{ fontSize:12 }} />
                    </button>
                  )}
                </div>
              )}
              <input ref={photoInput} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) { setCropFile({ empId: emp.id, file: e.target.files[0] }); e.target.value = '' } }} />
            </div>
            {cropFile && cropFile.empId === emp.id && (
              <PhotoCropModal file={cropFile.file}
                onCancel={() => setCropFile(null)}
                onSave={(blob) => { setCropFile(null); handlePhotoUpload(emp.id, blob) }} />
            )}
            <div className="detail-name">{lang==='ar' && emp.name_ar ? emp.name_ar : emp.name}</div>
            {(lang==='ar' ? emp.name : emp.name_ar) && <div className="detail-sub">{lang==='ar' ? emp.name : emp.name_ar}</div>}
            {(() => {
              const src = employeeStatusSource(emp, coaches)
              const ds = effectiveStatus(src)
              const dl = lang==='ar'
                ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','When needed':'عند الحاجة','External':'خارجي'}[ds]||ds)
                : (ds||'—')
              const expired = src.status_end && new Date(src.status_end) < new Date(new Date().toDateString())
              return (
                <div className="detail-badges" style={{ margin:'10px 0' }}>
                  <span className={`badge ${statusClass(ds)}`}>{dl}</span>
                  {(src.status_start || src.status_end) && !expired && (
                    <span className="badge badge-gray">{[src.status_start, src.status_end].filter(Boolean).join(' → ')}</span>
                  )}
                </div>
              )
            })()}
            <RoleBadges roles={personRoles} lang={lang} excludeType="employee" />
            <div className="detail-fields">
              {[
                [tx('profile.nationality','Nationality'), tc(emp.nationality)],
                [tx('profile.phone','Phone'), emp.phone],
                [tx('profile.email','Email'), emp.email],
              ].filter(([, v]) => v).map(([k,v]) => (
                <div key={k} className="detail-row"><span className="dk">{k}</span><span className="dv" style={{ fontSize:12 }}>{v}</span></div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* EMPLOYEE INFORMATION — only populated fields, card height
                fits content (no fixed/min height), Employee #/QSS # live
                here only, not duplicated on the profile card. */}
            {(() => {
              const fields = [
                [tx('form.designation','Designation'), lang==='ar' ? (emp.designation_ar || emp.designation) : emp.designation],
                [tx('profile.employeeNum','Staff Number'), emp.employee_number],
                [tx('profile.qssNumber','QSS #'), emp.qss_number],
                [lang==='ar'?'تاريخ الانضمام':'Join Date', formatFriendlyDate(emp.created_at, lang==='ar')],
                [lang==='ar'?'سنوات الخدمة':'Years of Service', yearsOfService],
              ].filter(([k, v]) => k && v)
              if (fields.length === 0) return null
              return (
                <div className="info-card">
                  <div className="info-title" style={{ marginBottom:10 }}>{lang==='ar'?'معلومات الكادر':'Staff Information'}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'4px 16px' }}>
                    {fields.map(([k,v]) => (
                      <div key={k} className="detail-row" style={{ minWidth:0 }}>
                        <span className="dk">{k}</span>
                        <span className="dv" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {(() => {
              const idFields = [
                [lang==='ar'?'تاريخ الميلاد':'Date of birth', emp.dob],
                [lang==='ar'?'الرقم الشخصي / رقم الهوية':'Qatar ID number', emp.id_number],
                [lang==='ar'?'تاريخ انتهاء الهوية':'ID expiry', emp.id_expiry],
                [lang==='ar'?'رقم جواز السفر':'Passport number', emp.passport_number],
                [lang==='ar'?'تاريخ انتهاء الجواز':'Passport expiry', emp.passport_expiry],
                [lang==='ar'?'شهادة اديل':'ADEL Certificate', emp.adel_certificate],
              ].filter(([, v]) => v)
              if (idFields.length === 0) return null
              const isExpired = d => d && new Date(d) < new Date()
              return (
                <div className="info-card">
                  <div className="info-title" style={{ marginBottom:10 }}>{lang==='ar'?'وثائق الهوية':'Identity Documents'}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2, 1fr)', gap:'4px 16px' }}>
                    {idFields.map(([k,v]) => (
                      <div key={k} className="detail-row" style={{ minWidth:0 }}>
                        <span className="dk">{k}</span>
                        <span className="dv" style={{ color: k.toLowerCase().includes('expiry') && isExpired(v) ? '#dc2626' : undefined }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {emp.notes && (
              <div className="info-card">
                <div className="info-title">{tx('employees.notes','Notes')}</div>
                <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6 }}>{emp.notes}</p>
              </div>
            )}

            <PersonDocuments
              personId={emp.id}
              personType="employee"
              personName={emp.name}
              docs={personDocs}
              onRefresh={onRefresh}
              profile={profile}
              sharedPersonId={emp.person_id}
              designation={emp.designation}
            />

            <CareerHistory personId={emp.id} personType="employee" personName={emp.name} />
          </div>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div>
      {(addModal || editForm) && (
        <EmpModal data={editForm||{}} isEdit={!!editForm} onClose={() => { setAddModal(false); setEditForm(null) }} onSave={handleSave} employees={employees} customDesignations={customDesignations} onDesignationAdded={d => setCustomDesignations(p => [...p, d])} />
      )}
      {bulkDocsOpen && (
        <BulkImportEmployeeDocsModal
          employees={employees}
          personDocs={personDocs || []}
          lang={lang}
          profile={profile}
          onClose={() => setBulkDocsOpen(false)}
          onDone={onRefresh}
        />
      )}
      {pendingStatusSave && (
        <StatusScopeModal
          roles={pendingStatusSave.roles}
          currentRoleType="employee"
          lang={lang}
          onConfirm={(types) => applyStatusToRoles(types, pendingStatusSave)}
          onCancel={() => setPendingStatusSave(null)}
        />
      )}
      <div className="page-header">
        <div><div className="page-title">{tx('pages.employees','Staff')}</div><div className="page-sub">{list.length} {tx('employees.ofEmployees','of')} {employees.length} {tx('pages.employees','staff')}</div></div>
        <div style={{ display:'flex', gap:8 }}>
          {!restrictedView && (
            <button className="btn" style={{ background:'#009F6B' }} onClick={() => exportEmployeesExcel(list, lang, coaches)}>
              <i className="ti ti-table-export" /> {tx('actions.exportExcel','Export Excel')}
            </button>
          )}
          <div style={{ position:'relative' }} ref={colPickerRef}>
            {!restrictedView && (
              <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={() => setColPickerOpen(o => !o)}>
                <i className="ti ti-columns" /> {lang==='ar' ? 'أعمدة' : 'Columns'} {visibleCols.length !== ALL_COLS.length && `(${visibleCols.length})`}
              </button>
            )}
            {colPickerOpen && (() => {
              const COL_GROUPS = [
                { label: lang==='ar' ? 'الهوية' : 'Identity', keys: ['name','employee_number','qss_number','job_id'] },
                { label: lang==='ar' ? 'الدور' : 'Role', keys: ['designation','designation_ar','status'] },
                { label: lang==='ar' ? 'شخصي' : 'Personal', keys: ['nationality','gender','phone','email'] },
                { label: lang==='ar' ? 'وثائق الهوية' : 'Identity Documents', keys: ['dob','id_number','id_expiry','passport_number','passport_expiry','adel_certificate'] },
              ]
              return (
                <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, zIndex:200, boxShadow:'0 8px 24px rgba(0,0,0,.12)', minWidth:220, maxHeight:420, display:'flex', flexDirection:'column', overflow:'hidden' }}>
                  <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--border)', display:'flex', gap:6, flexWrap:'wrap', flexShrink:0 }}>
                    <button onClick={() => setVisibleCols(ALL_COLS.map(c=>c.key))} style={{ flex:1, padding:'5px', fontSize:11, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text2)' }}>{tx('filters.all','All')}</button>
                    <button onClick={() => setVisibleCols(DEFAULT_EMPLOYEE_COLS)} style={{ flex:1, padding:'5px', fontSize:11, background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:7, cursor:'pointer', color:'var(--text2)' }}>{tx('filters.default','Default')}</button>
                    <button onClick={() => setVisibleCols(['name'])} style={{ flex:1, padding:'5px', fontSize:11, background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:7, cursor:'pointer', color:'#dc2626' }}>{tx('filters.none','None')}</button>
                  </div>
                  <div style={{ overflowY:'auto', padding:'8px 4px' }}>
                    {COL_GROUPS.map(group => (
                      <div key={group.label}>
                        <div style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', padding:'8px 12px 4px' }}>{group.label}</div>
                        {group.keys.map(key => {
                          const col = ALL_COLS.find(c => c.key === key)
                          if (!col) return null
                          return (
                            <label key={col.key} style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px', cursor:col.key==='name'?'not-allowed':'pointer', borderRadius:8 }}>
                              <input type="checkbox" checked={isVisible(col.key)} disabled={col.key==='name'} onChange={() => toggleCol(col.key)}
                                style={{ width:14, height:14, cursor:col.key==='name'?'not-allowed':'pointer', accentColor:'#0085C7' }} />
                              <span style={{ fontSize:13, color:col.key==='name'?'var(--text3)':'var(--text)' }}>{col.label}</span>
                              {col.key==='name' && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:'auto' }}>{tx('filters.always','always')}</span>}
                            </label>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
          </div>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setColFilters({}) }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              <i className="ti ti-x" style={{ fontSize:13 }} /> {tx('actions.resetFilters','Reset filters')}
            </button>
          )}
          {canEdit(profile) && (
            <button className="action-btn action-btn-edit" style={{ padding:'8px 14px', fontSize:13 }} onClick={() => setBulkDocsOpen(true)}>
              <i className="ti ti-file-upload" /> {lang==='ar' ? 'رفع مستندات' : 'Upload Documents'}
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-blue" onClick={() => setAddModal(true)}><i className="ti ti-plus" /> {tx('employees.addEmployee','Add staff member')}</button>
          )}
        </div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <i className="ti ti-search" />
          <input placeholder={tx("employees.searchEmployees","Search by name, designation…")} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>



      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              {ALL_COLS.filter(c => isVisible(c.key)).map((c, i) => {
                const isSortable = ['name','employee_number','qss_number','job_id','designation','designation_ar','status','nationality','gender','phone','email','dob','id_number','id_expiry','passport_number','passport_expiry','adel_certificate'].includes(c.key)
                const isAsc  = sort === `${c.key}-asc`
                const isDesc = sort === `${c.key}-desc`
                const active = isAsc || isDesc
                const isFirstCol = i === 0 && c.key === 'name'
                return (
                  <th key={c.key}
                    onClick={() => isSortable && (isAsc ? setSort(`${c.key}-desc`) : setSort(`${c.key}-asc`))}
                    style={{
                      cursor: isSortable ? 'pointer' : 'default', userSelect:'none', whiteSpace:'nowrap',
                      position:'sticky', top:0, zIndex: isFirstCol ? 23 : 21, background:'var(--surface)',
                      ...(isFirstCol ? (lang==='ar'
                        ? { right:0, minWidth:STICKY_NAME_COL_WIDTH, boxShadow:'-2px 0 4px rgba(0,0,0,.06)' }
                        : { left:0, minWidth:STICKY_NAME_COL_WIDTH, boxShadow:'2px 0 4px rgba(0,0,0,.06)' }
                      ) : {}),
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      {c.label}
                      {isSortable && (
                        <span style={{ fontSize:9, color: active ? '#0085C7' : '#ccc' }}>
                          {isAsc ? '▲' : isDesc ? '▼' : '▲▼'}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
              <th style={{ position:'sticky', top:0, zIndex:21, background:'var(--surface)' }} />
            </tr>
            <tr style={{ background:'#f8f9fb' }}>
              {ALL_COLS.filter(c => isVisible(c.key)).map((c, i) => {
                const isFirstCol = i === 0 && c.key === 'name'
                return (
                  <th key={c.key} style={{ padding:'4px 8px', position:'sticky', top:32, zIndex: isFirstCol ? 22 : 20, background:'#f8f9fb',
                      ...(isFirstCol ? (lang==='ar' ? { right:0, minWidth:STICKY_NAME_COL_WIDTH } : { left:0, minWidth:STICKY_NAME_COL_WIDTH }) : {}) }}>
                    {COL_FILTERS[c.key] ? (() => {
                      const key = c.key
                      const dropdownOptions = [
                        ...COL_FILTERS[key].map(o => ({
                          value: o,
                          label: key==='designation' ? (lang==='ar' ? (employees.find(e => e.designation === o)?.designation_ar || o) : o)
                            : key==='nationality' ? tc(o)
                            : key==='gender' ? ({'Male':lang==='ar'?'ذكر':'Male','Female':lang==='ar'?'أنثى':'Female'}[o]||o)
                            : (COL_FILTER_LABELS[key]?.[o]||o),
                        })),
                        ...(key==='status' ? [] : [{ value: 'Blank', label: lang==='ar'?'فارغ':'Blank' }]),
                      ]
                      const FIELD_GETTERS = {
                        designation: e => e.designation,
                        nationality: e => e.nationality,
                        gender: e => e.gender,
                        status: e => effectiveStatus(employeeStatusSource(e, coaches)),
                        adel_certificate: e => e.adel_certificate,
                      }
                      const defaultMatch = (fieldVal, optionVal) => optionVal === 'Blank' ? !fieldVal : fieldVal === optionVal
                      const getCount = computeEmployeeOptionCounts(key, FIELD_GETTERS[key], defaultMatch)
                      const filterCounts = dropdownOptions.reduce((acc, o) => { acc[o.value] = getCount(o.value); return acc }, {})
                      return (
                        <MultiSelectFilter
                          options={dropdownOptions}
                          selected={colFilters[key] || []}
                          allLabel={lang==='ar'?'الكل':'All'}
                          onChange={vals => setColFilters(f => ({ ...f, [key]: vals }))}
                          style={{ maxWidth: 130 }}
                          counts={filterCounts}
                        />
                      )
                    })() : null}
                  </th>
                )
              })}
              <th style={{ position:'sticky', top:32, zIndex:20, background:'#f8f9fb' }} />
            </tr>
          </thead>
          <tbody>
            {list.map(emp => {
              const cols = ALL_COLS.filter(c => isVisible(c.key))
              const stickyCellBg = hoveredRowId === emp.id ? 'var(--surface2)' : 'var(--surface)'
              return (
                <tr key={emp.id} className={restrictedView ? 'row-restricted' : undefined} onClick={() => {
                if (restrictedView) return
                if (COACH_DESIGNATIONS.includes(emp.designation) && coaches?.length) {
                  const coach = coaches.find(c =>
                    c.status !== 'Inactive' && (
                      (emp.qss_number && c.qss_number && c.qss_number === emp.qss_number) ||
                      (emp.name && c.name && c.name.trim().toLowerCase() === emp.name.trim().toLowerCase())
                    )
                  )
                  if (coach) { onNav('coaches', { coachId: coach.id, returnTo: 'employees' }); return }
                }
                setSelected(emp.id)
              }}
                onMouseEnter={() => setHoveredRowId(emp.id)}
                onMouseLeave={() => setHoveredRowId(prev => prev === emp.id ? null : prev)}
                style={{ cursor: restrictedView ? 'default' : 'pointer' }}>
                {cols.map((c, i) => {
                  const isFirstCol = i === 0 && c.key === 'name'
                  const stickyStyle = isFirstCol ? {
                    position:'sticky', ...(lang==='ar' ? { right:0 } : { left:0 }), zIndex:10, minWidth:STICKY_NAME_COL_WIDTH,
                    background:stickyCellBg, boxShadow: lang==='ar' ? '-2px 0 4px rgba(0,0,0,.06)' : '2px 0 4px rgba(0,0,0,.06)',
                  } : undefined
                  if (c.key === 'name') {
                    return (
                      <td key={c.key} style={stickyStyle}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {emp.photo_url
                            ? <img src={emp.photo_url} alt={emp.name} style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                            : <div className="av" style={{ width:32, height:32, fontSize:11, background:DESIG_COLORS[emp.designation]||'#9aa3b2', flexShrink:0 }}>{initials(emp.name)}</div>
                          }
                          <div>
                            <div style={{ fontWeight:500, fontSize:13 }}>{lang==='ar' && emp.name_ar ? emp.name_ar : emp.name}</div>
                            <div style={{ fontSize:11, color:'#9aa3b2' }}>{lang==='ar' ? emp.name : (emp.name_ar||tc(emp.nationality))}</div>
                          </div>
                        </div>
                      </td>
                    )
                  }
                  if (c.key === 'designation') return (
                    <td key={c.key}>
                      <div><DesigBadge label={emp.designation} displayLabel={lang==='ar' ? (emp.designation_ar || emp.designation) : emp.designation} /></div>
                    </td>
                  )
                  if (c.key === 'designation_ar') return <td key={c.key} style={{ fontSize:11, color:'#9aa3b2', direction:'rtl' }}>{emp.designation_ar||'—'}</td>
                  if (c.key === 'nationality') return <td key={c.key} style={{ fontSize:13, color:'#5a6272' }}>{tc(emp.nationality)||'—'}</td>
                  if (c.key === 'gender') return <td key={c.key} style={{ fontSize:13, color:'#5a6272' }}>{emp.gender ? (lang==='ar' ? (emp.gender==='Male'?'ذكر':'أنثى') : emp.gender) : '—'}</td>
                  if (c.key === 'employee_number') return <td key={c.key} style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.employee_number||'—'}</td>
                  if (c.key === 'qss_number') return <td key={c.key} style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.qss_number||'—'}</td>
                  if (c.key === 'job_id') return <td key={c.key} style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.job_id||'—'}</td>
                  if (c.key === 'phone') return <td key={c.key} style={{ fontSize:13, color:'#5a6272' }}>{emp.phone||'—'}</td>
                  if (c.key === 'email') return <td key={c.key} style={{ fontSize:13, color:'#5a6272' }}>{emp.email||'—'}</td>
                  if (c.key === 'dob') return <td key={c.key} style={{ fontSize:13, color:'#5a6272' }}>{emp.dob||'—'}</td>
                  if (c.key === 'id_number') return <td key={c.key} style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.id_number||'—'}</td>
                  if (c.key === 'id_expiry') return <td key={c.key} style={{ fontSize:13, color: emp.id_expiry && new Date(emp.id_expiry) < new Date() ? '#dc2626' : '#5a6272' }}>{emp.id_expiry||'—'}</td>
                  if (c.key === 'passport_number') return <td key={c.key} style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.passport_number||'—'}</td>
                  if (c.key === 'passport_expiry') return <td key={c.key} style={{ fontSize:13, color: emp.passport_expiry && new Date(emp.passport_expiry) < new Date() ? '#dc2626' : '#5a6272' }}>{emp.passport_expiry||'—'}</td>
                  if (c.key === 'adel_certificate') return <td key={c.key} style={{ fontSize:13, color:'#5a6272' }}>{emp.adel_certificate||'—'}</td>
                  if (c.key === 'status') return (
                    <td key={c.key}>{(() => {
                      const src = employeeStatusSource(emp, coaches)
                      const ds = effectiveStatus(src)
                      const dl = lang==='ar' ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','When needed':'عند الحاجة','External':'خارجي'}[ds]||ds) : (ds||'—')
                      return <span className={`badge ${statusClass(ds)}`}>{dl}</span>
                    })()}</td>
                  )
                  return <td key={c.key}>—</td>
                })}
                {!restrictedView && <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>}
              </tr>
              )
            })}
            {list.length === 0 && (() => {
              const cols = ALL_COLS.filter(c => isVisible(c.key))
              return <tr><td colSpan={cols.length + 1}><div className="empty">{tx('employees.noEmployeesMatch','No employees match')}</div></td></tr>
            })()}
          </tbody>
        </table>
      </div>
    </div>
  )
}
