import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Film, Calendar, List } from 'lucide-react'
import { getUserPlaylists, getProfile } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import PlaylistCard from '../components/PlaylistCard'

export default function ProfilePage({ user }) {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [playlists, setPlaylists] = useState([])
  const [loading, setLoading] = useState(true)

  const isOwnProfile = user?.id === id

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const [profileRes, playlistsRes] = await Promise.all([
      getProfile(id),
      getUserPlaylists(id),
    ])

    setProfile(profileRes.data)
    // If viewing someone else's profile, only show public playlists
    const lists = playlistsRes.data || []
    setPlaylists(isOwnProfile ? lists : lists.filter(p => p.is_public))
    setLoading(false)
  }

  const username = profile?.username || user?.user_metadata?.username || 'User'
  const joinDate = profile?.created_at
    ? formatDistanceToNow(new Date(profile.created_at), { addSuffix: true })
    : null
  const totalItems = playlists.reduce((sum, p) => {
    const count = p.playlist_items?.[0]?.count ?? 0
    return sum + count
  }, 0)

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">
        <div className="flex items-center gap-5 mb-10">
          <div className="skeleton w-20 h-20 !rounded-full" />
          <div>
            <div className="skeleton h-7 w-40 mb-2" />
            <div className="skeleton h-4 w-24" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card overflow-hidden">
              <div className="skeleton h-36" />
              <div className="p-4 space-y-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8 py-10">

      {/* Back */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm mb-8 transition-colors fade-up"
        style={{ color: 'var(--t3)' }}
        onMouseEnter={e => e.target.style.color = 'var(--t1)'}
        onMouseLeave={e => e.target.style.color = 'var(--t3)'}>
        <ArrowLeft size={14} /> Discover
      </Link>

      {/* Profile header */}
      <div className="flex items-center gap-5 mb-10 fade-up stagger-1">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-display font-bold shrink-0"
          style={{ background: 'var(--accent)', color: 'white' }}>
          {username[0].toUpperCase()}
        </div>
        <div>
          <h1 className="font-display font-extrabold text-2xl mb-1" style={{ color: 'var(--t1)' }}>
            {username}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {joinDate && (
              <span className="badge">
                <Calendar size={11} className="mr-1" /> Joined {joinDate}
              </span>
            )}
            <span className="badge">
              <List size={11} className="mr-1" /> {playlists.length} playlist{playlists.length !== 1 ? 's' : ''}
            </span>
            <span className="badge">
              <Film size={11} className="mr-1" /> {totalItems} moment{totalItems !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Playlists */}
      <div className="fade-up stagger-2">
        <h2 className="font-display font-bold text-lg mb-5" style={{ color: 'var(--t1)' }}>
          {isOwnProfile ? 'Your Playlists' : `${username}'s Playlists`}
        </h2>

        {playlists.length === 0 ? (
          <div className="text-center py-16"
            style={{ border: '1px dashed var(--border)', borderRadius: 12 }}>
            <Film size={36} className="mx-auto mb-3" style={{ color: 'var(--t3)' }} />
            <p className="text-sm" style={{ color: 'var(--t2)' }}>
              {isOwnProfile ? "You haven't created any playlists yet." : 'No public playlists yet.'}
            </p>
            {isOwnProfile && (
              <Link to="/?create=1" className="btn-primary text-sm mt-4 inline-flex">
                Create your first playlist
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {playlists.map((p, i) => (
              <PlaylistCard key={p.id} playlist={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
