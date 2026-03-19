import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Plus, TrendingUp, Clock, Search, X, Film, Sparkles } from 'lucide-react'
import { getPublicPlaylists, searchPlaylists, createPlaylist } from '../lib/supabase'
import PlaylistCard from '../components/PlaylistCard'

export default function Home({ user }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState(params.get('sort') || 'recent')
  const [searchQuery, setSearchQuery] = useState(params.get('q') || '')
  const [showCreate, setShowCreate] = useState(params.get('create') === '1')

  // New playlist form
  const [newTitle, setNewTitle] = useState('')
  const [newShow, setNewShow] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadPlaylists()
  }, [sort, searchQuery])

  async function loadPlaylists() {
    setLoading(true)
    try {
      if (searchQuery) {
        const { data } = await searchPlaylists(searchQuery)
        setPlaylists(data || [])
      } else {
        const { data } = await getPublicPlaylists({ sort, limit: 30 })
        setPlaylists(data || [])
      }
    } catch (err) {
      console.error('Failed to load playlists:', err)
      setPlaylists([])
    }
    setLoading(false)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newTitle.trim() || !user) return
    setCreating(true)
    try {
      const { data, error } = await createPlaylist({
        title: newTitle.trim(),
        show_name: newShow.trim(),
        description: newDesc.trim(),
      })
      if (data) {
        navigate(`/playlist/${data.id}`)
      } else {
        alert(error?.message || 'Failed to create playlist')
      }
    } catch (err) {
      alert('Error creating playlist')
    }
    setCreating(false)
  }

  return (
    <div className="max-w-6xl mx-auto px-5 md:px-8 py-10">

      {/* Hero section */}
      <div className="mb-10 fade-up">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles size={18} style={{ color: 'var(--accent)' }} />
          <span className="text-xs font-mono uppercase tracking-widest" style={{ color: 'var(--t3)' }}>
            Netflix moments, curated
          </span>
        </div>
        <h1 className="font-display font-extrabold text-3xl md:text-4xl leading-tight mb-3"
          style={{ color: 'var(--t1)' }}>
          Discover Playlists
        </h1>
        <p className="text-base max-w-lg" style={{ color: 'var(--t3)' }}>
          Every Kramer entrance. Every "that's what she said." Every time someone says "pivot."
          Save moments, share lists.
        </p>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-8 fade-up stagger-1">
        {/* Sort tabs */}
        <div className="flex items-center rounded-lg overflow-hidden"
          style={{ border: '1px solid var(--border)' }}>
          {[
            { key: 'recent', icon: Clock, label: 'Recent' },
            { key: 'popular', icon: TrendingUp, label: 'Popular' },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key}
              onClick={() => { setSort(key); setSearchQuery('') }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: sort === key && !searchQuery ? 'var(--surface-2)' : 'transparent',
                color: sort === key && !searchQuery ? 'var(--t1)' : 'var(--t3)',
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Search indicator */}
        {searchQuery && (
          <div className="flex items-center gap-2 badge">
            <Search size={12} />
            "{searchQuery}"
            <button onClick={() => setSearchQuery('')}
              className="hover:text-white transition-colors ml-1">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Create button */}
        <div className="ml-auto">
          {user ? (
            <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
              <Plus size={16} /> New Playlist
            </button>
          ) : (
            <button onClick={() => navigate('/auth')} className="btn-ghost text-sm">
              Sign in to create
            </button>
          )}
        </div>
      </div>

      {/* Playlist grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton h-36" />
              <div className="p-4 space-y-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
                <div className="skeleton h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="text-center py-20 fade-in">
          <Film size={40} className="mx-auto mb-4" style={{ color: 'var(--t3)' }} />
          <h3 className="font-display font-semibold text-lg mb-2" style={{ color: 'var(--t2)' }}>
            {searchQuery ? 'No playlists found' : 'No playlists yet'}
          </h3>
          <p className="text-sm mb-6" style={{ color: 'var(--t3)' }}>
            {searchQuery
              ? `Nothing matched "${searchQuery}". Try a different search.`
              : 'Be the first to create one!'}
          </p>
          {user && !searchQuery && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={16} /> Create First Playlist
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {playlists.map((p, i) => (
            <PlaylistCard key={p.id} playlist={p} index={i} />
          ))}
        </div>
      )}

      {/* Create playlist modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 fade-up"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>

            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-bold text-xl" style={{ color: 'var(--t1)' }}>
                New Playlist
              </h2>
              <button onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-md hover:bg-white/5" style={{ color: 'var(--t3)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
                  Playlist title *
                </label>
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder='e.g. "Every Kramer Entrance"'
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
                  Show name
                </label>
                <input
                  value={newShow}
                  onChange={e => setNewShow(e.target.value)}
                  placeholder="e.g. Seinfeld"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
                  Description
                </label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="What makes this playlist special?"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newTitle.trim()} className="btn-primary flex-1">
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
