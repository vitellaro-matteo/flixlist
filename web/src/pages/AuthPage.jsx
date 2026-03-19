import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { signIn, signUp } from '../lib/supabase'

export default function AuthPage({ user }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Redirect if already signed in
  useEffect(() => {
    if (user) navigate('/')
  }, [user])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (!username.trim()) { setError('Username is required'); setLoading(false); return }
        const { error: err } = await signUp(email, password, username.trim())
        if (err) throw err
        setSuccess('Check your email for a confirmation link!')
      } else {
        const { error: err } = await signIn(email, password)
        if (err) throw err
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex">

      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-center flex-1 p-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f0f12 0%, #1a0a0b 100%)' }}>
        {/* Decorative glow */}
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, var(--accent), transparent)' }} />

        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Film size={24} className="text-white" />
            </div>
            <span className="font-display font-extrabold text-3xl tracking-tight" style={{ color: 'var(--t1)' }}>
              Flix<span style={{ color: 'var(--accent)' }}>List</span>
            </span>
          </div>

          <h2 className="font-display font-bold text-2xl leading-snug mb-4" style={{ color: 'var(--t1)' }}>
            Netflix moments,{' '}
            <span style={{ color: 'var(--accent)' }}>curated and shared.</span>
          </h2>

          <p className="text-base leading-relaxed mb-8" style={{ color: 'var(--t3)' }}>
            Build playlists of your favorite TV moments. Save them with our Chrome extension while you watch.
            Share with anyone.
          </p>

          <div className="space-y-4">
            {[
              'Create playlists like "Every Office Cold Open"',
              'Chrome extension saves moments while you watch',
              'Share public playlists with a link',
              'Like and discover what others curate',
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-3">
                <ArrowRight size={14} className="mt-1 shrink-0" style={{ color: 'var(--accent)' }} />
                <span className="text-sm" style={{ color: 'var(--t2)' }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm fade-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--accent)' }}>
              <Film size={18} className="text-white" />
            </div>
            <span className="font-display font-bold text-xl">
              Flix<span style={{ color: 'var(--accent)' }}>List</span>
            </span>
          </div>

          <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--t1)' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-sm mb-6" style={{ color: 'var(--t3)' }}>
            {mode === 'signin'
              ? 'Sign in to your FlixList account.'
              : 'Start building your first playlist.'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(45,212,160,0.1)', border: '1px solid rgba(45,212,160,0.2)', color: 'var(--green)' }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
                  Username
                </label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="kramer_fan_42"
                  className="input-field"
                  required={mode === 'signup'}
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field !pr-10"
                  required
                  minLength={6}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--t3)' }}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-sm mt-2">
              {loading
                ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                : (mode === 'signin' ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--t3)' }}>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setSuccess('') }}
              className="font-medium transition-colors"
              style={{ color: 'var(--accent)' }}>
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
