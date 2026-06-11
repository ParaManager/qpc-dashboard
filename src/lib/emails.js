const ADMIN_EMAIL = 'hsinou@gmail.com'
const APP_URL = 'https://qpc-dashboard.vercel.app'

async function sendEmail(to, subject, html) {
  try {
    const res = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, html }),
    })
    const data = await res.json()
    if (!res.ok) console.warn('Email error:', data)
    return data
  } catch (e) {
    console.warn('Email send failed:', e)
  }
}

const baseStyle = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:#0a1628;padding:24px 28px;display:flex;align-items:center;gap:12px">
      <div style="display:flex;gap:5px">
        <div style="width:12px;height:12px;border-radius:50%;background:#EE334E"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#0085C7"></div>
        <div style="width:12px;height:12px;border-radius:50%;background:#009F6B"></div>
      </div>
      <span style="color:#fff;font-size:15px;font-weight:700">Qatar Paralympic Committee</span>
    </div>
`
const baseEnd = `
    <div style="padding:16px 28px;background:#f8f9fb;border-top:1px solid #e2e5ea">
      <p style="margin:0;font-size:11px;color:#9aa3b2">Qatar Paralympic Committee Dashboard · This is an automated message</p>
    </div>
  </div>
`

export async function notifyAdminNewRequest({ fullName, email, accountType }) {
  const typeLabel = { coach:'Coach', athlete:'Athlete', guest:'Guest / Viewer' }[accountType] || accountType
  const html = `${baseStyle}
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0a1628">New Access Request</h2>
      <p style="color:#5a6272;margin:0 0 20px">Someone has requested access to the QPC Dashboard and is waiting for your approval.</p>
      <div style="background:#f8f9fb;border-radius:10px;padding:16px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#9aa3b2;font-size:13px;width:120px">Name</td><td style="padding:6px 0;font-weight:600;font-size:13px">${fullName}</td></tr>
          <tr><td style="padding:6px 0;color:#9aa3b2;font-size:13px">Email</td><td style="padding:6px 0;font-size:13px">${email}</td></tr>
          <tr><td style="padding:6px 0;color:#9aa3b2;font-size:13px">Account type</td><td style="padding:6px 0;font-size:13px"><span style="background:#0085C720;color:#0085C7;padding:2px 10px;border-radius:20px;font-weight:600">${typeLabel}</span></td></tr>
        </table>
      </div>
      <a href="${APP_URL}" style="display:inline-block;padding:11px 24px;background:#0085C7;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">
        Review Request →
      </a>
    </div>
  ${baseEnd}`
  return sendEmail(ADMIN_EMAIL, `New Access Request — ${fullName}`, html)
}

export async function notifyUserApproved({ email, fullName, accountType }) {
  const typeLabel = { coach:'Coach', athlete:'Athlete', guest:'Guest / Viewer' }[accountType] || accountType
  const html = `${baseStyle}
    <div style="padding:28px">
      <div style="width:52px;height:52px;border-radius:50%;background:#009F6B20;display:flex;align-items:center;justify-content:center;margin-bottom:16px">
        <span style="font-size:24px">✓</span>
      </div>
      <h2 style="margin:0 0 8px;font-size:20px;color:#0a1628">Access Approved!</h2>
      <p style="color:#5a6272;margin:0 0 20px">Hello ${fullName}, your access request has been approved. You can now sign in to the QPC Dashboard.</p>
      <div style="background:#009F6B10;border:1px solid #009F6B30;border-radius:10px;padding:14px 16px;margin-bottom:20px">
        <p style="margin:0;font-size:13px;color:#009F6B;font-weight:600">✓ Account activated as: ${typeLabel}</p>
      </div>
      <a href="${APP_URL}" style="display:inline-block;padding:11px 24px;background:#009F6B;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">
        Sign In Now →
      </a>
    </div>
  ${baseEnd}`
  return sendEmail(email, 'Your QPC Dashboard Access Has Been Approved ✓', html)
}

export async function notifyUserRejected({ email, fullName, reason }) {
  const html = `${baseStyle}
    <div style="padding:28px">
      <h2 style="margin:0 0 8px;font-size:20px;color:#0a1628">Access Request Update</h2>
      <p style="color:#5a6272;margin:0 0 20px">Hello ${fullName}, unfortunately your access request to the QPC Dashboard has not been approved at this time.</p>
      ${reason ? `<div style="background:#EE334E10;border:1px solid #EE334E30;border-radius:10px;padding:14px 16px;margin-bottom:20px"><p style="margin:0;font-size:13px;color:#EE334E"><strong>Reason:</strong> ${reason}</p></div>` : ''}
      <p style="color:#5a6272;font-size:13px">If you believe this is a mistake, please contact the administrator directly.</p>
    </div>
  ${baseEnd}`
  return sendEmail(email, 'Your QPC Dashboard Access Request', html)
}
