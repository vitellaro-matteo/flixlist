import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Heart, ExternalLink, Plus, Trash2, ArrowLeft, Share2, Copy,
  Check, Edit3, Save, X, Tv, Clock, Film
} from 'lucide-react'
import {
  getPlaylist, addItem, removeItem, toggleLike, hasLiked,
  updatePlaylist, deletePlaylist
} from '../lib/supabase'

export default function PlaylistPage({ user }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [playlist, setPlaylist] = useState(null)
  const [loading, setLoading] = useState(true)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // Add item form
  const [showAdd, setShowAdd] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addSeason, setAddSeason] = useState('')
  const [addEpisode, setAddEpisode] = useState('')
  const [addNote, setAddNote] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data } = await getPlaylist(id)
    if (data) {
      setPlaylist(data)
      setLikeCount(data.like_count || 0)
      setEditTitle(data.title)
      setEditDesc(data.description || '')
      if (user) {
        const isLiked = await hasLiked(id)
        setLiked(isLiked)
      }
    }
    setLoading(false)
  }

  const isOwner = user && playlist?.user_id === user.id
  const author = playlist?.profiles?.username || 'anon'
  const items = playlist?.playlist_items || []

  async function handleLike() {
    if (!user) return navigate('/auth')
    const { liked: nowLiked } = await toggleLike(id)
    setLiked(nowLiked)
    setLikeCount(c => nowLiked ? c + 1 : c - 1)
  }

  async function handleShare() {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      prompt('Copy this link:', url)
    }
  }

  async function handleSaveEdit() {
    await updatePlaylist(id, { title: editTitle, description: editDesc })
    setPlaylist(p => ({ ...p, title: editTitle, description: editDesc }))
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this playlist permanently?')) return
    await deletePlaylist(id)
    navigate('/')
  }

  async function handleAddItem(e) {
    e.preventDefault()
    if (!addTitle.trim()) return
    setAdding(true)

    // Extract Netflix ID from URL if possible
    const match = addUrl.match(/watch\/(\d+)/)
    const netflixId = match ? match[1] : null

    const { data, error } = await addItem(id, {
      netflix_id: netflixId,
      netflix_url: addUrl.trim() || null,
      title: addTitle.trim(),
      poster_url: null,
      season: addSeason ? parseInt(addSeason) : null,
      episode: addEpisode ? parseInt(addEpisode) : null,
      note: addNote.trim() || null,
    })

    if (data) {
      setPlaylist(p => ({ ...p, playlist_items: [...(p.playlist_items || []), data] }))
      setAddTitle(''); setAddUrl(''); setAddSeason(''); setAddEpisode(''); setAddNote('')
      setShowAdd(false)
    } else {
      alert(error?.message || 'Failed to add item')
    }
    setAdding(false)
  }

  async function handleRemoveItem(itemId) {
    if (!confirm('Remove this item?')) return
    await removeItem(itemId)
    setPlaylist(p => ({
      ...p,
      playlist_items: p.playlist_items.filter(i => i.id !== itemId)
    }))
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">
        <div className="skeleton h-8 w-48 mb-4" />
        <div className="skeleton h-4 w-96 mb-8" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20" />)}
        </div>
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="max-w-3xl mx-auto px-5 md:px-8 py-20 text-center">
        <Film size={48} className="mx-auto mb-4" style={{ color: 'var(--t3)' }} />
        <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--t2)' }}>
          Playlist not found
        </h2>
        <Link to="/" className="btn-ghost mt-4 inline-flex">
          <ArrowLeft size={16} /> Back home
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-5 md:px-8 py-10">

      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors fade-up"
        style={{ color: 'var(--t3)' }}
        onMouseEnter={e => e.target.style.color = 'var(--t1)'}
        onMouseLeave={e => e.target.style.color = 'var(--t3)'}>
        <ArrowLeft size={14} /> All playlists
      </Link>

      {/* Header */}
      <div className="mb-8 fade-up stagger-1">
        {editing ? (
          <div className="space-y-3 mb-4">
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="input-field !text-xl font-display font-bold" />
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
              className="input-field resize-none" rows={2} placeholder="Description…" />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="btn-primary text-sm">
                <Save size={14} /> Save
              </button>
              <button onClick={() => setEditing(false)} className="btn-ghost text-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display font-extrabold text-2xl md:text-3xl leading-tight mb-1"
                  style={{ color: 'var(--t1)' }}>
                  {playlist.title}
                </h1>
                {playlist.show_name && (
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--accent)' }}>
                    {playlist.show_name}
                  </p>
                )}
              </div>
            </div>

            {playlist.description && (
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--t3)' }}>
                {playlist.description}
              </p>
            )}

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-3">
              <Link to={`/profile/${playlist.user_id}`}
                className="badge hover:border-white/20 transition-colors">
                by {author}
              </Link>
              <span className="badge"><Tv size={11} className="mr-1" /> {items.length} moment{items.length !== 1 ? 's' : ''}</span>

              {/* Actions */}
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={handleLike}
                  className="btn-ghost text-sm !px-3"
                  style={liked ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : {}}>
                  <Heart size={14} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
                </button>
                <button onClick={handleShare} className="btn-ghost text-sm !px-3">
                  {copied ? <><Check size={14} /> Copied!</> : <><Share2 size={14} /> Share</>}
                </button>
                {isOwner && (
                  <>
                    <button onClick={() => setEditing(true)} className="btn-ghost text-sm !px-3">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={handleDelete}
                      className="btn-ghost text-sm !px-3 hover:!text-red-400 hover:!border-red-400/40">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Items list */}
      <div className="space-y-2 mb-6 fade-up stagger-2">
        {items
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .map((item, i) => (
          <div key={item.id}
            className="card !rounded-lg flex items-center gap-4 p-4 group hover:!border-[var(--border-light)]">

            {/* Number */}
            <span className="w-7 text-center text-sm font-mono shrink-0"
              style={{ color: 'var(--t3)' }}>
              {i + 1}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate" style={{ color: 'var(--t1)' }}>
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {item.season && (
                  <span className="text-xs" style={{ color: 'var(--t3)' }}>
                    S{item.season}{item.episode ? `E${item.episode}` : ''}
                  </span>
                )}
                {item.note && (
                  <span className="text-xs italic truncate" style={{ color: 'var(--t3)' }}>
                    — {item.note}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              {item.netflix_url && (
                <a href={item.netflix_url} target="_blank" rel="noopener"
                  className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--accent)' }}
                  title="Open in Netflix">
                  <ExternalLink size={14} />
                </a>
              )}
              {isOwner && (
                <button onClick={() => handleRemoveItem(item.id)}
                  className="p-1.5 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--t3)' }}
                  title="Remove">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="text-center py-12 fade-in"
          style={{ border: '1px dashed var(--border)', borderRadius: 12 }}>
          <Tv size={32} className="mx-auto mb-3" style={{ color: 'var(--t3)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--t2)' }}>No moments yet</p>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>
            {isOwner ? 'Add your first item below, or use the Chrome extension while watching Netflix.' : 'The author hasn\'t added items yet.'}
          </p>
        </div>
      )}

      {/* Add item */}
      {isOwner && (
        <div className="mt-4 fade-up stagger-3">
          {showAdd ? (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-sm" style={{ color: 'var(--t1)' }}>
                  Add a moment
                </h3>
                <button onClick={() => setShowAdd(false)}
                  className="p-1 rounded-md hover:bg-white/5" style={{ color: 'var(--t3)' }}>
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleAddItem} className="space-y-3">
                <input value={addTitle} onChange={e => setAddTitle(e.target.value)}
                  placeholder="What happens? e.g. Kramer slides through the door"
                  className="input-field" required />
                <input value={addUrl} onChange={e => setAddUrl(e.target.value)}
                  placeholder="Netflix URL (optional) — e.g. https://netflix.com/watch/12345"
                  className="input-field" />
                <div className="flex gap-3">
                  <input value={addSeason} onChange={e => setAddSeason(e.target.value)}
                    placeholder="Season" type="number" min="1" className="input-field w-24" />
                  <input value={addEpisode} onChange={e => setAddEpisode(e.target.value)}
                    placeholder="Episode" type="number" min="1" className="input-field w-24" />
                  <input value={addNote} onChange={e => setAddNote(e.target.value)}
                    placeholder="Note (optional)" className="input-field flex-1" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowAdd(false)} className="btn-ghost text-sm">
                    Cancel
                  </button>
                  <button type="submit" disabled={adding || !addTitle.trim()} className="btn-primary text-sm">
                    {adding ? 'Adding…' : 'Add Moment'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="btn-ghost w-full justify-center text-sm">
              <Plus size={16} /> Add Moment
            </button>
          )}
        </div>
      )}
    </div>
  )
}
