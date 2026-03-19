import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, User, LogOut, Film, Menu, X } from 'lucide-react'
import { signOut } from '../lib/supabase'

export default function Navbar({ user }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/?q=${encodeURIComponent(query.trim())}`)
      setQuery('')
      setSearchOpen(false)
    }
  }

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'user'

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center px-5 md:px-8"
      style={{ background: 'linear-gradient(to bottom, rgba(10,10,12,0.95), rgba(10,10,12,0.8))', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' }}>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 mr-6 shrink-0 group">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--accent)' }}>
          <Film size={16} className="text-white" />
        </div>
        <span className="font-display font-bold text-lg tracking-tight hidden sm:block"
          style={{ color: 'var(--t1)' }}>
          Flix<span style={{ color: 'var(--accent)' }}>List</span>
        </span>
      </Link>

      {/* Desktop nav links */}
      <nav className="hidden md:flex items-center gap-1 mr-auto">
        {[
          { to: '/', label: 'Discover' },
          { to: '/?sort=popular', label: 'Popular' },
        ].map(({ to, label }) => (
          <Link key={label} to={to}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            style={{ color: 'var(--t2)' }}
            onMouseEnter={e => { e.target.style.color = 'var(--t1)'; e.target.style.background = 'var(--surface)' }}
            onMouseLeave={e => { e.target.style.color = 'var(--t2)'; e.target.style.background = 'transparent' }}>
            {label}
          </Link>
        ))}
      </nav>

      {/* Search */}
      <div className="flex items-center gap-2 ml-auto">
        {searchOpen ? (
          <form onSubmit={handleSearch} className="fade-in flex items-center gap-2">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search playlists…"
              className="input-field !py-1.5 !text-sm w-48 md:w-64"
            />
            <button type="button" onClick={() => setSearchOpen(false)}
              className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
              style={{ color: 'var(--t3)' }}>
              <X size={16} />
            </button>
          </form>
        ) : (
          <button onClick={() => setSearchOpen(true)}
            className="p-2 rounded-md hover:bg-white/5 transition-colors"
            style={{ color: 'var(--t2)' }}>
            <Search size={18} />
          </button>
        )}

        {user ? (
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: 'var(--accent)', color: 'white' }}>
                {username[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--t2)' }}>
                {username}
              </span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl overflow-hidden shadow-2xl fade-in"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {[
                  { icon: User, label: 'My Profile', action: () => { navigate(`/profile/${user.id}`); setMenuOpen(false) } },
                  { icon: Plus, label: 'New Playlist', action: () => { navigate('/?create=1'); setMenuOpen(false) } },
                ].map(({ icon: Icon, label, action }) => (
                  <button key={label} onClick={action}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--t2)' }}
                    onMouseEnter={e => e.target.style.color = 'var(--t1)'}
                    onMouseLeave={e => e.target.style.color = 'var(--t2)'}>
                    <Icon size={14} /> {label}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid var(--border)' }} />
                <button onClick={async () => { await signOut(); setMenuOpen(false); navigate('/') }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--t3)' }}
                  onMouseEnter={e => e.target.style.color = '#ef4444'}
                  onMouseLeave={e => e.target.style.color = 'var(--t3)'}>
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/auth" className="btn-primary text-sm !py-1.5 !px-4">Sign In</Link>
        )}

        {/* Mobile hamburger */}
        <button className="md:hidden p-2 rounded-md hover:bg-white/5"
          style={{ color: 'var(--t2)' }}
          onClick={() => setMenuOpen(!menuOpen)}>
          <Menu size={18} />
        </button>
      </div>

      {/* Click-away */}
      {menuOpen && <div className="fixed inset-0 z-[-1]" onClick={() => setMenuOpen(false)} />}
    </header>
  )
}
