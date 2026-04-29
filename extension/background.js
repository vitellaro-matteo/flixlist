// FlixList — Background Service Worker

const SUPABASE_URL = 'https://vkhyoiyxeakjkbagzouv.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZraHlvaXl4ZWFramtiYWd6b3V2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4NzA1NjIsImV4cCI6MjA4OTQ0NjU2Mn0.mlXeQDoNckWs0g_ECyLuzncDzZwQLSKsjkUaeUwD_yg'

// ─── Token management with auto-refresh ──────────

async function getTokens() {
  const d = await chrome.storage.local.get(['flixlist_token', 'flixlist_refresh'])
  return { access: d.flixlist_token || null, refresh: d.flixlist_refresh || null }
}
async function saveTokens(access, refresh) {
  await chrome.storage.local.set({ flixlist_token: access, flixlist_refresh: refresh })
}
async function clearAuth() {
  await chrome.storage.local.remove(['flixlist_token', 'flixlist_refresh', 'flixlist_user'])
}

async function refreshSession() {
  const { refresh } = await getTokens()
  if (!refresh) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    const data = await res.json()
    if (data.access_token) {
      await saveTokens(data.access_token, data.refresh_token)
      if (data.user) await chrome.storage.local.set({ flixlist_user: data.user })
      return data.access_token
    }
  } catch {}
  await clearAuth()
  return null
}

async function getValidToken() {
  const { access } = await getTokens()
  if (!access) return null
  try {
    const payload = JSON.parse(atob(access.split('.')[1]))
    if (Date.now() < payload.exp * 1000 - 30000) return access
  } catch {}
  return await refreshSession()
}

// ─── Supabase REST ───────────────────────────────

async function supaFetch(path, options = {}) {
  const token = await getValidToken()
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
    if (res.status === 401 || res.status === 403) {
      await clearAuth()
      throw new Error('Session expired — please sign in again')
    }
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
      await saveTokens(data.access_token, data.refresh_token)
      await chrome.storage.local.set({ flixlist_user: data.user })
      return { success: true, user: data.user }
    }
    return { success: false, error: data.error_description || data.msg || data.error || 'Invalid email or password' }
  } catch (err) { return { success: false, error: err.message } }
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
        await saveTokens(data.access_token, data.refresh_token)
        await chrome.storage.local.set({ flixlist_user: data.user })
      }
      return { success: true }
    }
    return { success: false, error: data.error_description || data.msg || data.error || 'Sign up failed' }
  } catch (err) { return { success: false, error: err.message } }
}

// ─── Data ────────────────────────────────────────

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
  return supaFetch('playlists', { method: 'POST', body: JSON.stringify({ title, user_id: flixlist_user.id, is_public: true }) })
}
async function addToPlaylist(playlistId, item) {
  return supaFetch('playlist_items', { method: 'POST', body: JSON.stringify({ playlist_id: playlistId, ...item }) })
}
async function removeFromPlaylist(itemId) {
  return supaFetch(`playlist_items?id=eq.${itemId}`, { method: 'DELETE' })
}
async function updateItem(itemId, updates) {
  return supaFetch(`playlist_items?id=eq.${itemId}`, { method: 'PATCH', body: JSON.stringify(updates) })
}

// ─── Message router ──────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const h = {
    SIGN_IN: () => signIn(msg.email, msg.password),
    SIGN_UP: () => signUp(msg.email, msg.password, msg.username),
    SIGN_OUT: async () => { await clearAuth(); return { success: true } },
    GET_PLAYLISTS: () => getMyPlaylists(),
    GET_PLAYLIST_ITEMS: () => getPlaylistItems(msg.playlistId),
    CREATE_PLAYLIST: () => createPlaylist(msg.title),
    ADD_TO_PLAYLIST: () => addToPlaylist(msg.playlistId, msg.item),
    REMOVE_ITEM: () => removeFromPlaylist(msg.itemId),
    UPDATE_ITEM: () => updateItem(msg.itemId, msg.updates),
    GET_USER: async () => {
      const token = await getValidToken()
      if (!token) { await clearAuth(); return null }
      const { flixlist_user } = await chrome.storage.local.get('flixlist_user')
      return flixlist_user || null
    },
  }
  const handler = h[msg.type]
  if (handler) { handler().then(sendResponse).catch(err => sendResponse({ error: err.message })); return true }
})
