export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.body
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!serviceKey) return res.status(500).json({ error: 'Service key not configured' })
  if (!userId)     return res.status(400).json({ error: 'userId required' })

  try {
    // Delete from Supabase Auth using service role key
    const res2 = await fetch(`https://leletocvhbvuquxpyulp.supabase.co/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      }
    })

    if (!res2.ok) {
      const err = await res2.json()
      return res.status(400).json({ error: err })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
