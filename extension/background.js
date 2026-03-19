// FlixList — Background Service Worker
// Supabase anon key is safe to expose — RLS policies protect data access.

const SUPABASE_URL = 'https://vkhyoiyxeakjkbagzouv.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZraHlvaXl4ZWFramtiYWd6b3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzA1NjIsImV4cCI6MjA4OTQ0NjU2Mn0.mlXeQDoNckWs0g_ECyLuzncDzZwQLSKsjkUaeUwD_yg'

// ─── Token ───────────────────────────────────────

async function getToken() {
  const { flixlist_token } = await chrome.storage.local.get('flixlist_token')
  return flixlist_token || null
}

async function setToken(token) {
  await chrome.storage.local.set({ flixlist_token: token })
}

// ─── Supabase REST ───────────────────────────────

async function supaFetch(path, options = {}) {
  const token = await getToken()
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token || SUPABASE_ANON}`,
      Prefer: options.prefer || 'return=representation',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`${res.status}: ${err}`)
  }
  return res.json()
}

// ─── Auth ────────────────────────────────────────

async function signIn(email, password) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (data.access_token) {
      await setToken(data.access_token)
      await chrome.storage.local.set({ flixlist_user: data.user })
      return { success: true, user: data.user }
    }
    return { success: false, error: data.error_description || data.msg || data.error || 'Invalid email or password' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

async function signUp(email, password, username) {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ email, password, data: { username } }),
    })
    const data = await res.json()
    if (data.id || data.access_token) {
      if (data.access_token) {
        await setToken(data.access_token)
        await chrome.storage.local.set({ flixlist_user: data.user })
      }
      return { success: true }
    }
    return { success: false, error: data.error_description || data.msg || data.error || 'Sign up failed' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Playlists ───────────────────────────────────

async function getMyPlaylists() {
  const { flixlist_user } = await chrome.storage.local.get('flixlist_user')
  if (!flixlist_user) return []
  return supaFetch(`playlists?user_id=eq.${flixlist_user.id}&order=created_at.desc&select=*,playlist_items(count)`)
}

async function getPlaylistItems(playlistId) {
  return supaFetch(`playlist_items?playlist_id=eq.${playlistId}&order=created_at.asc`)
}

async function createPlaylist(title) {
  const { flixlist_user } = await chrome.storage.local.get('flixlist_user')
  if (!flixlist_user) throw new Error('Not signed in')
  return supaFetch('playlists', {
    method: 'POST',
    body: JSON.stringify({ title, user_id: flixlist_user.id, is_public: true }),
  })
}

async function addToPlaylist(playlistId, item) {
  return supaFetch('playlist_items', {
    method: 'POST',
    body: JSON.stringify({ playlist_id: playlistId, ...item }),
  })
}

async function removeFromPlaylist(itemId) {
  return supaFetch(`playlist_items?id=eq.${itemId}`, { method: 'DELETE' })
}

// ─── Message Handler ─────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    SIGN_IN: () => signIn(msg.email, msg.password),
    SIGN_UP: () => signUp(msg.email, msg.password, msg.username),
    SIGN_OUT: async () => {
      await chrome.storage.local.remove(['flixlist_token', 'flixlist_user'])
      return { success: true }
    },
    GET_PLAYLISTS: () => getMyPlaylists(),
    GET_PLAYLIST_ITEMS: () => getPlaylistItems(msg.playlistId),
    CREATE_PLAYLIST: () => createPlaylist(msg.title),
    ADD_TO_PLAYLIST: () => addToPlaylist(msg.playlistId, msg.item),
    REMOVE_ITEM: () => removeFromPlaylist(msg.itemId),
    GET_USER: async () => {
      const { flixlist_user } = await chrome.storage.local.get('flixlist_user')
      return flixlist_user || null
    },
  }
  const handler = handlers[msg.type]
  if (handler) {
    handler().then(sendResponse).catch(err => sendResponse({ error: err.message }))
    return true
  }
})
