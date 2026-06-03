import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    // on success App.jsx will detect the session and show the dashboard
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a1628',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ width: 380, padding: '40px 36px', background: '#fff', borderRadius: 18, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 14 }}>
            {['#EE334E','#0085C7','#009F6B'].map(c => (
              <div key={c} style={{ width: 16, height: 16, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0a1628', letterSpacing: '-.02em' }}>Qatar Paralympic</div>
          <div style={{ fontSize: 13, color: '#9aa3b2', marginTop: 3 }}>Committee · Admin Portal</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#5a6272', display: 'block', marginBottom: 5 }}>Email address</label>
            <input
              type="email" required value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #e2e5ea', fontSize: 13, outline: 'none', transition: 'border .15s', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#0085C7'}
              onBlur={e => e.target.style.borderColor = '#e2e5ea'}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#5a6272', display: 'block', marginBottom: 5 }}>Password</label>
            <input
              type="password" required value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #e2e5ea', fontSize: 13, outline: 'none', transition: 'border .15s', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#0085C7'}
              onBlur={e => e.target.style.borderColor = '#e2e5ea'}
            />
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 15, flexShrink: 0 }} />{error}
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '11px', background: loading ? '#7cb9e8' : '#0085C7', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif' }}>
            {loading ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />Signing in…</> : 'Sign in'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9aa3b2' }}>
          Qatar Paralympic Committee · {new Date().getFullYear()}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
