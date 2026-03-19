import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ─── Auth ────────────────────────────────────────
export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ─── Profiles ────────────────────────────────────
// Fetched separately to avoid PostgREST FK join issues

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) console.error('getProfile error:', error)
  return { data, error }
}

// Helper: attach profile info to a list of playlists
async function attachProfiles(playlists) {
  if (!playlists?.length) return playlists

  // Collect unique user IDs
  const userIds = [...new Set(playlists.map(p => p.user_id).filter(Boolean))]
  if (!userIds.length) return playlists

  // Fetch all profiles in one query
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', userIds)

  const profileMap = {}
  ;(profiles || []).forEach(p => { profileMap[p.id] = p })

  // Attach to each playlist
  return playlists.map(p => ({
    ...p,
    profiles: profileMap[p.user_id] || { username: 'anon', avatar_url: null },
  }))
}

// ─── Playlists ───────────────────────────────────
export async function getPublicPlaylists({ limit = 20, offset = 0, sort = 'recent' } = {}) {
  let q = supabase
    .from('playlists')
    .select('*, playlist_items(count)')
    .eq('is_public', true)

  if (sort === 'popular') q = q.order('like_count', { ascending: false })
  else q = q.order('created_at', { ascending: false })

  const { data, error } = await q.range(offset, offset + limit - 1)
  if (error) {
    console.error('getPublicPlaylists error:', error)
    return { data: null, error }
  }

  const enriched = await attachProfiles(data)
  return { data: enriched, error: null }
}

export async function getPlaylist(id) {
  // Fetch playlist + items (no profiles join)
  const { data, error } = await supabase
    .from('playlists')
    .select('*, playlist_items(*)')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('getPlaylist error:', error)
    return { data: null, error }
  }
  if (!data) {
    return { data: null, error: { message: 'Not found' } }
  }

  // Fetch profile separately
  if (data.user_id) {
    const { data: profile } = await getProfile(data.user_id)
    data.profiles = profile || { username: 'anon', avatar_url: null }
  }

  return { data, error: null }
}

export async function createPlaylist({ title, description = '', show_name = '', is_public = true }) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: { message: 'Not signed in' } }

  const { data, error } = await supabase
    .from('playlists')
    .insert({ title, description, show_name, is_public, user_id: user.id })
    .select()
    .single()
  if (error) console.error('createPlaylist error:', error)
  return { data, error }
}

export async function updatePlaylist(id, updates) {
  const { data, error } = await supabase
    .from('playlists')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) console.error('updatePlaylist error:', error)
  return { data, error }
}

export async function deletePlaylist(id) {
  const { error } = await supabase.from('playlists').delete().eq('id', id)
  if (error) console.error('deletePlaylist error:', error)
  return { error }
}

// ─── Playlist Items ──────────────────────────────
export async function addItem(playlistId, { netflix_id, netflix_url, title, poster_url, season, episode, note }) {
  const { data, error } = await supabase
    .from('playlist_items')
    .insert({
      playlist_id: playlistId,
      netflix_id,
      netflix_url,
      title,
      poster_url: poster_url || null,
      season: season || null,
      episode: episode || null,
      note: note || null,
    })
    .select()
    .single()
  if (error) console.error('addItem error:', error)
  return { data, error }
}

export async function removeItem(itemId) {
  const { error } = await supabase.from('playlist_items').delete().eq('id', itemId)
  if (error) console.error('removeItem error:', error)
  return { error }
}

export async function reorderItems(playlistId, orderedIds) {
  const updates = orderedIds.map((id, i) => ({ id, position: i }))
  const promises = updates.map(u =>
    supabase.from('playlist_items').update({ position: u.position }).eq('id', u.id)
  )
  await Promise.all(promises)
}

// ─── Likes ───────────────────────────────────────
export async function toggleLike(playlistId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { liked: false, error: { message: 'Not signed in' } }

  const { data: existing } = await supabase
    .from('playlist_likes')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await supabase.from('playlist_likes').delete().eq('id', existing.id)
    await supabase.rpc('decrement_likes', { p_id: playlistId })
    return { liked: false }
  } else {
    await supabase.from('playlist_likes').insert({ playlist_id: playlistId, user_id: user.id })
    await supabase.rpc('increment_likes', { p_id: playlistId })
    return { liked: true }
  }
}

export async function hasLiked(playlistId) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('playlist_likes')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('user_id', user.id)
    .maybeSingle()
  return !!data
}

// ─── User Playlists ──────────────────────────────
export async function getUserPlaylists(userId) {
  const { data, error } = await supabase
    .from('playlists')
    .select('*, playlist_items(count)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) console.error('getUserPlaylists error:', error)
  return { data, error }
}

// ─── Search ──────────────────────────────────────
export async function searchPlaylists(query) {
  const { data, error } = await supabase
    .from('playlists')
    .select('*, playlist_items(count)')
    .eq('is_public', true)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,show_name.ilike.%${query}%`)
    .order('like_count', { ascending: false })
    .limit(30)

  if (error) {
    console.error('searchPlaylists error:', error)
    return { data: null, error }
  }

  const enriched = await attachProfiles(data)
  return { data: enriched, error: null }
}
