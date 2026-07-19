import { useState, useEffect, useRef } from 'react'
import { initials, statusClass, effectiveStatus, COACH_DESIGNATIONS } from '../lib/helpers'
import { ConfirmModal, toast } from '../components/Toast'
import { supabase } from '../lib/supabase'
import { canEdit } from '../lib/useAuth'
import { isTrustedAdmin } from '../lib/permissions'
import { logAdminActivity } from '../lib/adminActivity'
import CareerHistory from '../components/CareerHistory.jsx'
import { useLang } from '../lib/LangContext.jsx'
import PersonDocuments from '../components/PersonDocuments'
import * as XLSX from 'xlsx'
import EmployeeCardButton from '../components/EmployeeCard'
import PhotoCropModal from '../components/PhotoCropModal'
import { usePersonRoles, RoleBadges } from '../components/RoleBadges.jsx'
import StatusScopeModal from '../components/StatusScopeModal.jsx'

const DESIGNATIONS = [
  'All designations',
  'Coach', 'Assistant Coach', 'Technical Expert',
  'Physiotherapist', 'Doctor',
  'Secretary General', 'Executive Manager', 'Administration Secretary', 'Secretary Assistant',
  'Administrative National Team', 'Administrative Youth Team', 'Administrative Center & Development',
  'Accountant', 'Public Relation Officer', 'Receptionist',
  'Board Member', 'Official', 'Delegate',
  'Employee', 'Store Keeper', 'Waiter', 'Worker', 'Driver',
]

const COUNTRIES_EN = [
  'Afghanistan','Algeria','Argentina','Armenia','Australia','Azerbaijan',
  'Bahrain','Bangladesh','Belarus','Belgium','Brazil','Cameroon','Canada',
  'Chile','China','Colombia','Croatia','Czech Republic','Denmark','Egypt',
  'Eritrea','Ethiopia','Finland','France','Georgia','Germany','Ghana',
  'Greece','Guinea','Hungary','India','Indonesia','Iran','Iraq','Ireland',
  'Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan',
  'Lebanon','Libya','Malaysia','Mali','Mauritania','Mexico','Mongolia',
  'Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria',
  'Norway','Oman','Pakistan','Palestine','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Scotland',
  'Senegal','Serbia','Singapore','Slovakia','Somalia','South Africa',
  'South Korea','Spain','Sri Lanka','Sudan','Sweden','Syria','Tajikistan',
  'Tanzania','Thailand','Tunisia','Turkey','Turkmenistan','UAE','Uganda',
  'UK','Ukraine','USA','Uzbekistan','Venezuela','Vietnam','Wales',
  'Yemen','Zambia','Zimbabwe',
]
const COUNTRIES_AR_MAP = {
  'Qatar':'قطر','Egypt':'مصر','Algeria':'الجزائر','Morocco':'المغرب',
  'Tunisia':'تونس','Jordan':'الأردن','Saudi Arabia':'المملكة العربية السعودية',
  'UAE':'الإمارات','Kuwait':'الكويت','Bahrain':'البحرين','Oman':'عُمان',
  'Iraq':'العراق','Syria':'سوريا','Lebanon':'لبنان','Palestine':'فلسطين',
  'Yemen':'اليمن','Somalia':'الصومال','Sudan':'السودان','Libya':'ليبيا',
  'Pakistan':'باكستان','India':'الهند','Bangladesh':'بنغلاديش',
  'Iran':'إيران','Turkey':'تركيا','Afghanistan':'أفغانستان',
  'Nigeria':'نيجيريا','Ghana':'غانا','Kenya':'كينيا','Ethiopia':'إثيوبيا',
  'Cameroon':'الكاميرون','Senegal':'السنغال','Tanzania':'تنزانيا',
  'France':'فرنسا','Spain':'إسبانيا','Germany':'ألمانيا','Italy':'إيطاليا',
  'UK':'المملكة المتحدة','USA':'الولايات المتحدة','Canada':'كندا',
  'Australia':'أستراليا','Brazil':'البرازيل','Russia':'روسيا',
  'China':'الصين','Japan':'اليابان','South Korea':'كوريا الجنوبية',
  'Azerbaijan':'أذربيجان','Kazakhstan':'كازاخستان','Ireland':'أيرلندا',
  'Netherlands':'هولندا','Belgium':'بلجيكا','Sweden':'السويد',
  'Norway':'النرويج','Denmark':'الدنمارك','Poland':'بولندا',
  'Portugal':'البرتغال','Greece':'اليونان','Ukraine':'أوكرانيا',
  'Indonesia':'إندونيسيا','Malaysia':'ماليزيا','Philippines':'الفلبين',
  'Thailand':'تايلاند','Vietnam':'فيتنام','Sri Lanka':'سريلانكا',
  'Nepal':'نيبال','Mongolia':'منغوليا','South Africa':'جنوب أفريقيا',
}

const DESIG_AR = {
  'Coach':'مدرب', 'Assistant Coach':'مدرب مساعد', 'Technical Expert':'خبير تقني',
  'Physiotherapist':'معالج فيزيائي', 'Doctor':'طبيب',
  'Secretary General':'الأمين العام', 'Executive Manager':'مدير تنفيذي',
  'Administration Secretary':'سكرتير إداري', 'Secretary Assistant':'مساعد سكرتير',
  'Administrative National Team':'إداري الفريق الوطني',
  'Administrative Youth Team':'إداري فريق الشباب',
  'Administrative Center & Development':'إداري المركز والتطوير',
  'Accountant':'محاسب', 'Public Relation Officer':'مسؤول علاقات عامة',
  'Receptionist':'موظف استقبال', 'Board Member':'عضو مجلس إدارة',
  'Official':'مسؤول', 'Delegate':'مندوب', 'Employee':'موظف',
  'Store Keeper':'أمين مخزن', 'Waiter':'نادل', 'Worker':'عامل', 'Driver':'سائق',
}

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
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Retired':'متقاعد'}
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
      ${isAr ? (DESIG_AR_MAP[emp.designation]||emp.designation||'') : (emp.designation||'')}
    </div>
    ${emp.designation_ar ? `<div style="font-size:12px;color:#5a6272;margin-top:2px">${emp.designation_ar}</div>` : ''}
  </div>
</div>

<div class="section-title">${L('Employee Information','معلومات الموظف')}</div>
<div class="grid-2">
  ${field(L('Employee #','رقم الموظف'), emp.employee_number)}
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

  /* LOGOS row */
  .logos {
    position: absolute;
    top: 28px; left: 270px;
    display: flex;
    align-items: center;
    gap: 14px;
    z-index: 5;
  }
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
  .divider-v { width: 1px; height: 56px; background: #c9a84c; }
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
    display: flex; flex-direction: column; align-items: flex-start; gap: 1px;
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
    width: 280px;
    height: 1.5px;
    background: linear-gradient(to right, #c9a84c, #f0d060, #c9a84c);
    margin: 10px 0;
    position: relative;
  }
  .name-divider::after {
    content: '';
    position: absolute;
    right: -6px; top: -4px;
    width: 10px; height: 10px;
    background: #c9a84c;
    border-radius: 50%;
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
    <div class="divider-v"></div>
    <!-- Qatar emblem -->
    <div class="logo-qatar">
      <div class="logo-qatar-badge">قطر<br/>QATAR</div>
      <svg width="32" height="14" viewBox="0 0 32 14">
        <circle cx="4" cy="7" r="4" fill="#0085C7"/>
        <circle cx="12" cy="7" r="4" fill="#EE334E"/>
        <circle cx="20" cy="7" r="4" fill="#009F6B"/>
        <circle cx="28" cy="7" r="4" fill="#f1c40f"/>
      </svg>
    </div>
    <div class="divider-v"></div>
    <!-- Special Olympics -->
    <div class="logo-so">
      <div class="logo-so-text">Special<br/>Olympics</div>
      <div class="logo-so-sub">Qatar</div>
      <div class="logo-so-sub-ar">الأولمبياد الخاص قطر</div>
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
  const STATUS_AR = {'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي','Retired':'متقاعد'}
  const DESIG_AR_MAP = {'Coach':'مدرب','Assistant Coach':'مدرب مساعد','Technical Expert':'خبير تقني','Physiotherapist':'معالج فيزيائي','Doctor':'طبيب','Secretary General':'الأمين العام','Executive Manager':'مدير تنفيذي','Administration Secretary':'سكرتير إداري','Secretary Assistant':'مساعد سكرتير','Administrative National Team':'إداري الفريق الوطني','Administrative Youth Team':'إداري فريق الشباب','Administrative Center & Development':'إداري المركز والتطوير','Accountant':'محاسب','Public Relation Officer':'مسؤول علاقات عامة','Receptionist':'موظف استقبال','Board Member':'عضو مجلس إدارة','Official':'مسؤول','Delegate':'مندوب','Employee':'موظف','Store Keeper':'أمين مخزن','Waiter':'نادل','Worker':'عامل','Driver':'سائق'}
  const COUNTRY_MAP = {'qatar':'قطر','egypt':'مصر','algeria':'الجزائر','morocco':'المغرب','jordan':'الأردن','saudi arabia':'المملكة العربية السعودية','uae':'الإمارات','kuwait':'الكويت','bahrain':'البحرين','oman':'عُمان','iraq':'العراق','syria':'سوريا','lebanon':'لبنان','yemen':'اليمن','somalia':'الصومال','sudan':'السودان','libya':'ليبيا','tunisia':'تونس','pakistan':'باكستان','india':'الهند','iran':'إيران','turkey':'تركيا','ireland':'أيرلندا','france':'فرنسا','spain':'إسبانيا','germany':'ألمانيا','uk':'المملكة المتحدة','usa':'الولايات المتحدة'}
  const tc = n => n ? (ar ? (COUNTRY_MAP[n.toLowerCase().trim()]||n) : n) : ''
  const L = (en, a) => ar ? a : en

  const rows = list.map(e => ({
    [L('Name','الاسم')]:                  ar && e.name_ar ? e.name_ar : (e.name||''),
    [L('English Name','الاسم بالإنجليزي')]:  ar && e.name_ar ? e.name : (e.name_ar||''),
    [L('Designation','المسمى الوظيفي')]: ar ? (DESIG_AR_MAP[e.designation]||e.designation||'') : (e.designation||''),
    [L('Designation AR','المسمى بالعربي')]: e.designation_ar || '',
    [L('Gender','الجنس')]:             e.gender ? (ar?(e.gender==='Male'?'ذكر':'أنثى'):e.gender) : '',
    [L('Nationality','الجنسية')]:      tc(e.nationality),
    [L('Employee #','رقم الموظف')]:    e.employee_number || '',
    [L('QSS #','رقم QSS')]:           e.qss_number || '',
    [L('Phone','الهاتف')]:             e.phone || '',
    [L('Email','البريد الإلكتروني')]:   e.email || '',
    [L('Status','الحالة')]:            (() => { const es = effectiveStatus(employeeStatusSource(e, coaches)); return ar ? (STATUS_AR[es]||es||'') : (es||'') })(),
    [L('Notes','ملاحظات')]:            e.notes || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{wch:24},{wch:24},{wch:28},{wch:24},{wch:8},{wch:16},{wch:14},{wch:10},{wch:16},{wch:26},{wch:10},{wch:30}]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, ar ? 'الموظفون' : 'Employees')
  XLSX.writeFile(wb, `QPC_${ar?'الموظفون':'Employees'}_${new Date().toISOString().slice(0,10)}.xlsx`)
}

function EmpModal({ data, isEdit, onClose, onSave, customDesignations = [], onDesignationAdded }) {
  const [form, setForm] = useState(data || { status:'Active' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const { lang } = useLang()
  const ar = lang === 'ar'
  const [showNewDesig, setShowNewDesig] = useState(false)
  const [newDesigEn, setNewDesigEn] = useState('')
  const [newDesigAr, setNewDesigAr] = useState('')
  const [newDesigErr, setNewDesigErr] = useState('')
  const [savingDesig, setSavingDesig] = useState(false)

  // Merge the fixed built-in designations with any custom ones already saved
  // in Supabase, de-duplicated case-insensitively so a custom entry that
  // happens to match a built-in one doesn't show twice.
  const allDesignations = (() => {
    const base = DESIGNATIONS.slice(1).map(d => ({ label: d, label_ar: DESIG_AR[d] || '' }))
    const seen = new Set(base.map(d => d.label.trim().toLowerCase()))
    const extra = customDesignations.filter(d => {
      const key = (d.label||'').trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    return [...base, ...extra].sort((a, b) => a.label.localeCompare(b.label))
  })()

  async function handleAddDesignation() {
    const label = newDesigEn.trim()
    const labelAr = newDesigAr.trim()
    if (!label) { setNewDesigErr(ar ? 'الرجاء إدخال المسمى الوظيفي' : 'Please enter a designation'); return }
    const dupe = allDesignations.some(d => d.label.trim().toLowerCase() === label.toLowerCase())
    if (dupe) { setNewDesigErr(ar ? 'هذا المسمى موجود بالفعل' : 'This designation already exists'); return }
    setSavingDesig(true)
    setNewDesigErr('')
    const { data: inserted, error } = await supabase.from('employee_designations')
      .insert({ label, label_ar: labelAr || null })
      .select('label, label_ar')
      .single()
    setSavingDesig(false)
    if (error) {
      // Unique constraint race — another admin may have just added the same one.
      setNewDesigErr(ar ? 'تعذر حفظ المسمى الوظيفي (قد يكون مكررًا)' : 'Could not save designation (it may already exist)')
      return
    }
    onDesignationAdded?.(inserted)
    set('designation', inserted.label)
    setShowNewDesig(false)
    setNewDesigEn(''); setNewDesigAr('')
  }
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
          <div className="modal-title">{isEdit ? (ar?'تعديل':'Edit') : (ar?'إضافة':'New')} {ar?'موظف':'Employee'}</div>
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
            {grp(ar?'الجنسية':'Nationality', sel("nationality", [{value:'',label:''},...COUNTRIES_EN.map(cn => ({value:cn, label: ar?(COUNTRIES_AR_MAP[cn]||cn):cn}))]))}
          </div>
          <div className="form-section">{ar?'الدور والتوظيف':'Role & Employment'}</div>
          <div className="form-row">
            {grp(ar?'المسمى الوظيفي (إنجليزي)':'Designation (English)', (
              <>
                <select className="form-input" value={showNewDesig ? '__add_new__' : (form.designation||'')} onChange={e => {
                  if (e.target.value === '__add_new__') { setShowNewDesig(true); return }
                  setShowNewDesig(false)
                  set('designation', e.target.value)
                }}>
                  <option value="">{''}</option>
                  {allDesignations.map(d => <option key={d.label} value={d.label}>{ar ? (d.label_ar || d.label) : d.label}</option>)}
                  <option value="__add_new__">{ar ? '+ إضافة مسمى وظيفي جديد' : '+ Add New Designation'}</option>
                </select>
                {showNewDesig && (
                  <div style={{ marginTop: 8, padding: 10, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input className="form-input" placeholder={ar?'المسمى الجديد (إنجليزي)':'New designation (English)'} value={newDesigEn} onChange={e => setNewDesigEn(e.target.value)} />
                      <input className="form-input" placeholder={ar?'المسمى الجديد (عربي)':'New designation (Arabic)'} value={newDesigAr} onChange={e => setNewDesigAr(e.target.value)} dir="rtl" />
                    </div>
                    {newDesigErr && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{newDesigErr}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="btn-cancel" onClick={() => { setShowNewDesig(false); setNewDesigEn(''); setNewDesigAr(''); setNewDesigErr('') }}>{ar?'إلغاء':'Cancel'}</button>
                      <button type="button" className="btn" style={{ background:'#0085C7' }} disabled={savingDesig} onClick={handleAddDesignation}>{savingDesig ? (ar?'جارٍ الحفظ...':'Saving...') : (ar?'حفظ':'Save')}</button>
                    </div>
                  </div>
                )}
              </>
            ))}
            {grp(ar?'المسمى الوظيفي (عربي)':'Designation (Arabic)', inp("designation_ar", "text", "e.g. مدرب"))}
          </div>
          <div className="form-row">
            {grp(ar?'رقم الموظف':'Employee number', inp("employee_number", "text", "e.g. 12501"))}
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
          <div className="form-group">
            <label className="form-label">{ar?'ملاحظات':'Notes'}</label>
            <textarea className="form-input" rows={3} value={form.notes||''} onChange={e => set('notes', e.target.value)} style={{ resize:'vertical' }} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onClose}>{ar?'إلغاء':'Cancel'}</button>
          <button className="btn btn-blue" onClick={() => onSave(form, isEdit)}>
            {isEdit ? (ar?'حفظ التغييرات':'Save changes') : (ar?'إضافة موظف':'Add employee')}
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
  const photoInput = useRef(null)
  const [cropFile, setCropFile] = useState(null) // { empId, file } pending crop

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
    designation: ['All', ...[...new Set([...DESIGNATIONS.slice(1), ...customDesignations.map(d => d.label)])], 'Blank'],
    nationality: ['All', ...['Afghanistan', 'Algeria', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahrain', 'Bangladesh', 'Belarus', 'Belgium', 'Brazil', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Croatia', 'Czech Republic', 'Denmark', 'Egypt', 'Eritrea', 'Ethiopia', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Guinea', 'Hungary', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Italy', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait', 'Kyrgyzstan', 'Lebanon', 'Libya', 'Malaysia', 'Mali', 'Mauritania', 'Mexico', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand', 'Nigeria', 'Norway', 'Oman', 'Pakistan', 'Palestine', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saudi Arabia', 'Scotland', 'Senegal', 'Serbia', 'Singapore', 'Slovakia', 'Somalia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sudan', 'Sweden', 'Syria', 'Tajikistan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'Turkmenistan', 'UAE', 'Uganda', 'UK', 'Ukraine', 'USA', 'Uzbekistan', 'Venezuela', 'Vietnam', 'Wales', 'Yemen', 'Zambia', 'Zimbabwe'], 'Blank'],
    gender:      ['All','Male','Female','Blank'],
    status:      ['All','Active','On Leave','In Competition','In Training Camp','Inactive','Retired'],
  }
  const COL_FILTER_LABELS = {
    gender: { 'All':tx('filters.all','All'), 'Male':tx('form.male','Male'), 'Female':tx('form.female','Female') },
    status: { 'All':tx('filters.all','All'), 'Active':tx('status.active','Active'), 'On Leave':tx('status.onLeave','On Leave'), 'In Competition': lang==='ar' ? 'في منافسة' : 'In Competition', 'In Training Camp': lang==='ar' ? 'في معسكر تدريبي' : 'In Training Camp', 'Inactive':tx('status.inactive','Inactive'), 'Retired': lang==='ar' ? 'متقاعد' : 'Retired' },
  }

  let list = employees.filter(e =>
    (!search || e.name.toLowerCase().includes(search.toLowerCase()) ||
               (e.name_ar||'').toLowerCase().includes(search.toLowerCase()) ||
               (e.designation||'').toLowerCase().includes(search.toLowerCase()) ||
               (e.designation_ar||'').toLowerCase().includes(search.toLowerCase())) &&
    (!colFilters.designation || colFilters.designation === 'All' || (colFilters.designation === 'Blank' ? !e.designation : e.designation === colFilters.designation)) &&
    (!colFilters.nationality || colFilters.nationality === 'All' || (colFilters.nationality === 'Blank' ? !e.nationality : e.nationality === colFilters.nationality)) &&
    (!colFilters.gender      || colFilters.gender === 'All'      || (colFilters.gender === 'Blank' ? !e.gender : e.gender === colFilters.gender)) &&
    (!colFilters.status      || colFilters.status === 'All'      || effectiveStatus(employeeStatusSource(e, coaches)) === colFilters.status)
  )
  list = [...list].sort((a, b) => {
    if (sort === 'name-asc')   return a.name.localeCompare(b.name)
    if (sort === 'name-desc')  return b.name.localeCompare(a.name)
    if (sort === 'desig-asc')  return (a.designation||'').localeCompare(b.designation||'')
    if (sort === 'desig-desc') return (b.designation||'').localeCompare(a.designation||'')
    if (sort === 'nat-asc')    return (a.nationality||'').localeCompare(b.nationality||'')
    if (sort === 'nat-desc')   return (b.nationality||'').localeCompare(a.nationality||'')
    if (sort === 'gender-asc')   return (a.gender||'').localeCompare(b.gender||'')
    if (sort === 'gender-desc')  return (b.gender||'').localeCompare(a.gender||'')
    if (sort === 'emp-asc')      return (a.employee_number||'').localeCompare(b.employee_number||'')
    if (sort === 'emp-desc')     return (b.employee_number||'').localeCompare(a.employee_number||'')
    if (sort === 'qss-asc')      return (a.qss_number||'').localeCompare(b.qss_number||'')
    if (sort === 'qss-desc')     return (b.qss_number||'').localeCompare(a.qss_number||'')
    if (sort === 'status-asc')   return (effectiveStatus(employeeStatusSource(a, coaches))||'').localeCompare(effectiveStatus(employeeStatusSource(b, coaches))||'')
    if (sort === 'status-desc')  return (effectiveStatus(employeeStatusSource(b, coaches))||'').localeCompare(effectiveStatus(employeeStatusSource(a, coaches))||'')
    return 0
  })

  async function handleDelete(id, name) {
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) { toast(error.message, 'error'); return }
    toast(`${name} deleted`)
    if (isTrustedAdmin(profile)) {
      logAdminActivity({ actor: profile, action: 'deleted', entityType: 'employee', entityId: id, entityLabel: name, module: 'employees' })
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
      await supabase.from('employees').update({ photo_url: data.publicUrl + '?t=' + Date.now() }).eq('id', empId)
      toast('Photo updated!'); await onRefresh()
    } catch (err) { toast(err.message || 'Upload failed', 'error') }
    finally { setUploading(false) }
  }

  function SortTh({ field, children }) {
    const isAsc  = sort === `${field}-asc`
    const isDesc = sort === `${field}-desc`
    return (
      <th onClick={() => isAsc ? setSort(`${field}-desc`) : setSort(`${field}-asc`)}
        style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          {children}
          <span style={{ fontSize:9, color:(isAsc||isDesc)?'#0085C7':'#ccc' }}>
            {isAsc?'▲':isDesc?'▼':'▲▼'}
          </span>
        </div>
      </th>
    )
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
        {editForm && <EmpModal data={editForm} isEdit={true} onClose={() => setEditForm(null)} onSave={handleSave} customDesignations={customDesignations} onDesignationAdded={d => setCustomDesignations(p => [...p, d])} />}
        {pendingStatusSave && (
          <StatusScopeModal
            roles={pendingStatusSave.roles}
            currentRoleType="employee"
            lang={lang}
            onConfirm={(types) => applyStatusToRoles(types, pendingStatusSave)}
            onCancel={() => setPendingStatusSave(null)}
          />
        )}
        {confirm && (
          <ConfirmModal title="Delete employee" message={`Delete ${emp.name}?`}
            onConfirm={() => handleDelete(emp.id, emp.name)} onCancel={() => setConfirm(null)} />
        )}
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
                ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي'}[ds]||ds)
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
                [tx('form.designation','Designation'), emp.designation_ar && lang==='ar' ? emp.designation_ar : (DESIG_LABELS[emp.designation] || emp.designation)],
                [tx('profile.employeeNum','Employee #'), emp.employee_number],
                [tx('profile.qssNumber','QSS #'), emp.qss_number],
                [lang==='ar'?'تاريخ الانضمام':'Join Date', formatFriendlyDate(emp.created_at, lang==='ar')],
                [lang==='ar'?'سنوات الخدمة':'Years of Service', yearsOfService],
              ].filter(([k, v]) => k && v)
              if (fields.length === 0) return null
              return (
                <div className="info-card">
                  <div className="info-title" style={{ marginBottom:10 }}>{lang==='ar'?'معلومات الموظف':'Employee Information'}</div>
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
        <EmpModal data={editForm||{}} isEdit={!!editForm} onClose={() => { setAddModal(false); setEditForm(null) }} onSave={handleSave} customDesignations={customDesignations} onDesignationAdded={d => setCustomDesignations(p => [...p, d])} />
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
        <div><div className="page-title">{tx('pages.employees','Employees')}</div><div className="page-sub">{list.length} {tx('employees.ofEmployees','of')} {employees.length} {tx('pages.employees','employees')}</div></div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn" style={{ background:'#009F6B' }} onClick={() => exportEmployeesExcel(list, lang, coaches)}>
            <i className="ti ti-table-export" /> {tx('actions.exportExcel','Export Excel')}
          </button>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setColFilters({}) }}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'8px 12px', borderRadius:9, border:'1px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:12, cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              <i className="ti ti-x" style={{ fontSize:13 }} /> {tx('actions.resetFilters','Reset filters')}
            </button>
          )}
          {canEdit(profile) && (
            <button className="btn btn-blue" onClick={() => setAddModal(true)}><i className="ti ti-plus" /> {tx('employees.addEmployee','Add employee')}</button>
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
              <SortTh field="name">{tx('employees.employee','Employee')}</SortTh>
              <SortTh field="desig">{tx('employees.designation','Designation')}</SortTh>
              <SortTh field="nat">{tx('employees.nationality','Nationality')}</SortTh>
              <th onClick={() => setSort(sort==='gender-asc'?'gender-desc':'gender-asc')} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>{tx('employees.gender','Gender')} <span style={{ fontSize:9, color: sort.startsWith('gender')?'#0085C7':'#ccc' }}>{sort==='gender-asc'?'▲':sort==='gender-desc'?'▼':'▲▼'}</span></th>
              <th onClick={() => setSort(sort==='emp-asc'?'emp-desc':'emp-asc')} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>{tx('employees.employeeNum','Employee #')} <span style={{ fontSize:9, color: sort.startsWith('emp')?'#0085C7':'#ccc' }}>{sort==='emp-asc'?'▲':sort==='emp-desc'?'▼':'▲▼'}</span></th>
              <th onClick={() => setSort(sort==='qss-asc'?'qss-desc':'qss-asc')} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>{tx('employees.qssNum','QSS #')} <span style={{ fontSize:9, color: sort.startsWith('qss')?'#0085C7':'#ccc' }}>{sort==='qss-asc'?'▲':sort==='qss-desc'?'▼':'▲▼'}</span></th>
              <th onClick={() => setSort(sort==='status-asc'?'status-desc':'status-asc')} style={{ cursor:'pointer', userSelect:'none', whiteSpace:'nowrap' }}>{tx('employees.status','Status')} <span style={{ fontSize:9, color: sort.startsWith('status')?'#0085C7':'#ccc' }}>{sort==='status-asc'?'▲':sort==='status-desc'?'▼':'▲▼'}</span></th>
              <th />
            </tr>
            <tr style={{ background:'#f8f9fb' }}>
              <th />
              {[
                { key:'designation', span:1 },
                { key:'nationality', span:1 },
                { key:'gender',      span:1 },
                { key:null,          span:1 },
                { key:null,          span:1 },
                { key:'status',      span:1 },
              ].map(({ key }, i) => (
                <th key={i} style={{ padding:'4px 8px' }}>
                  {key && COL_FILTERS[key] ? (
                    <select
                      value={colFilters[key] || 'All'}
                      onChange={e => setColFilters(f => ({ ...f, [key]: e.target.value }))}
                      style={{ fontSize:11, border:'1px solid var(--border)', borderRadius:6, padding:'3px 4px', background:'var(--surface)', color:(colFilters[key]&&colFilters[key]!=='All')?'#0085C7':'var(--text3)', cursor:'pointer', outline:'none', fontWeight:(colFilters[key]&&colFilters[key]!=='All')?600:400, maxWidth:130 }}>
                      {COL_FILTERS[key].map(o => <option key={o} value={o}>{
                o==='Blank' ? (lang==='ar'?'فارغ':'Blank') :
                key==='designation' ? (DESIG_LABELS[o]||o) :
                key==='nationality' ? (o==='All' ? (lang==='ar'?'الكل':'All') : tc(o)) :
                key==='gender' ? ({'All':lang==='ar'?'الكل':'All','Male':lang==='ar'?'ذكر':'Male','Female':lang==='ar'?'أنثى':'Female'}[o]||o) :
                (COL_FILTER_LABELS[key]?.[o]||o)
              }</option>)}
                    </select>
                  ) : null}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map(emp => (
              <tr key={emp.id} onClick={() => {
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
            }} style={{ cursor:'pointer' }}>
                <td>
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
                <td>
                  <div><DesigBadge label={emp.designation} displayLabel={DESIG_LABELS[emp.designation]} /></div>
                  {emp.designation_ar && <div style={{ fontSize:11, color:'#9aa3b2', marginTop:3, direction:'rtl' }}>{emp.designation_ar}</div>}
                </td>
                <td style={{ fontSize:13, color:'#5a6272' }}>{tc(emp.nationality)||'—'}</td>
                <td style={{ fontSize:13, color:'#5a6272' }}>{emp.gender ? (lang==='ar' ? (emp.gender==='Male'?'ذكر':'أنثى') : emp.gender) : '—'}</td>
                <td style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.employee_number||'—'}</td>
                <td style={{ fontSize:12, color:'#5a6272', fontFamily:'monospace' }}>{emp.qss_number||'—'}</td>
                <td>{(() => {
                  const src = employeeStatusSource(emp, coaches)
                  const ds = effectiveStatus(src)
                  const dl = lang==='ar' ? ({'Active':'نشط','Inactive':'غير نشط','On Leave':'في إجازة','In Competition':'في منافسة','In Training Camp':'في معسكر تدريبي'}[ds]||ds) : (ds||'—')
                  return <span className={`badge ${statusClass(ds)}`}>{dl}</span>
                })()}</td>
                <td><i className="ti ti-chevron-right" style={{ color:'#ccc', fontSize:16 }} /></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8}><div className="empty">{tx('employees.noEmployeesMatch','No employees match')}</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
