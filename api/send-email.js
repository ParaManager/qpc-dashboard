export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, subject, html } = req.body
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' })
  if (!to || !subject || !html) return res.status(400).json({ error: 'Missing fields' })

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'QPC Dashboard <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        headers: {
          'X-Priority': '1',
          'X-Mailer': 'QPC Dashboard',
          'List-Unsubscribe': '<mailto:paralympicmanager@gmail.com>',
        },
        tags: [{ name: 'category', value: 'notification' }],
      }),
    })
    const data = await response.json()
    if (!response.ok) return res.status(400).json({ error: data })
    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
