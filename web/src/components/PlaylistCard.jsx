import { Link } from 'react-router-dom'
import { Heart, Play, Tv, Lock } from 'lucide-react'

export default function PlaylistCard({ playlist, index = 0 }) {
  const itemCount = playlist.playlist_items?.[0]?.count ?? playlist.playlist_items?.length ?? 0
  const author = playlist.profiles?.username || 'anon'
  const show = playlist.show_name || ''
  const isPrivate = !playlist.is_public

  // Generate a deterministic gradient from the playlist title
  const hue = [...(playlist.title || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  const gradient = `linear-gradient(135deg, hsl(${hue}, 40%, 14%) 0%, hsl(${(hue + 40) % 360}, 35%, 10%) 100%)`

  return (
    <Link
      to={`/playlist/${playlist.id}`}
      className="card group block overflow-hidden fade-up"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Visual header */}
      <div className="relative h-36 overflow-hidden" style={{ background: gradient }}>
        {/* Decorative film strip pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(90deg, transparent, transparent 30px, white 30px, white 31px)`,
          }}
        />
        {/* Center icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center opacity-20 group-hover:opacity-40 group-hover:scale-110 transition-all duration-300"
            style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)' }}>
            <Play size={20} fill="white" className="text-white ml-0.5" />
          </div>
        </div>
        {/* Item count badge */}
        <div className="absolute top-3 right-3 badge !text-[11px]">
          <Tv size={10} className="mr-1" /> {itemCount} moment{itemCount !== 1 ? 's' : ''}
        </div>
        {/* Private badge */}
        {isPrivate && (
          <div className="absolute top-3 left-3 badge !text-[11px]">
            <Lock size={10} className="mr-1" /> Private
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-display font-semibold text-[15px] leading-snug mb-1 line-clamp-2"
          style={{ color: 'var(--t1)' }}>
          {playlist.title}
        </h3>

        {show && (
          <p className="text-xs font-medium mb-2 truncate" style={{ color: 'var(--accent)' }}>
            {show}
          </p>
        )}

        {playlist.description && (
          <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: 'var(--t3)' }}>
            {playlist.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-2"
          style={{ borderTop: '1px solid var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--t3)' }}>
            by <span style={{ color: 'var(--t2)' }}>{author}</span>
          </span>
          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--t3)' }}>
            <Heart size={12} />
            {playlist.like_count || 0}
          </div>
        </div>
      </div>
    </Link>
  )
}
