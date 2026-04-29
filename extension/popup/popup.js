/**
 * FlixList Popup
 * No Supabase keys here. All API calls go through background.js via messaging.
 */

const $ = s => document.querySelector(s)

function msg(type, payload = null) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type, payload }, res => {
      if (chrome.runtime.lastError) resolve(null)
      else resolve(res)
    })
  })
}

let playlists = [], currentTabInfo = null, authMode = 'signin'

async function init() {
  const user = await msg('GET_USER')
  user ? await showMain(user) : showAuth()
}

function showAuth() {
  $('#view-auth').style.display = 'block'
  $('#view-main').style.display = 'none'
}

async function showMain(user) {
  $('#view-auth').style.display = 'none'
  $('#view-main').style.display = 'block'
  const name = user.user_metadata?.username || user.email?.split('@')[0] || 'User'
  if ($('#display-name')) $('#display-name').textContent = name
  if ($('#display-email')) $('#display-email').textContent = user.email || ''
  if ($('#avatar')) $('#avatar').textContent = name[0].toUpperCase()
  playlists = await msg('GET_USER_PLAYLISTS') || []
  renderMyPlaylists()
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (tab?.url?.includes('netflix.com/watch/')) {
    try {
      currentTabInfo = await new Promise((res, rej) => {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_INFO' }, r => {
          chrome.runtime.lastError ? rej() : res(r)
        })
      })
    } catch {
      const m = tab.url.match(/\/watch\/(\d+)/)
      if (m) currentTabInfo = { netflixId: m[1], netflixUrl: tab.url, seriesTitle: (tab.title||'').replace(' | Netflix','') || 'Netflix', episodeLabel: null, posterUrl: null }
    }
    if (currentTabInfo) {
      if ($('#current-title')) $('#current-title').textContent = currentTabInfo.seriesTitle
      if ($('#current-sub')) $('#current-sub').textContent = currentTabInfo.episodeLabel || ''
      const p = $('#current-poster')
      if (p) p.innerHTML = currentTabInfo.posterUrl ? `<img src="${currentTabInfo.posterUrl}" alt="">` : `<div class="item-poster-placeholder">🎬</div>`
      renderSaveTo()
      $('#current-item-section').style.display = 'block'
      $('#not-watching-section').style.display = 'none'
    }
  } else {
    $('#current-item-section').style.display = 'none'
    $('#not-watching-section').style.display = 'block'
  }
}

function renderSaveTo() {
  const list = $('#playlist-select-list')
  if (!list) return
  if (!playlists.length) { list.innerHTML = `<p class="empty-hint">No playlists — create one below.</p>`; return }
  list.innerHTML = playlists.map(pl => `
    <div class="playlist-option" data-id="${pl.id}">
      <div class="pl-opt-left"><span>${esc(pl.title)}</span><span class="pl-opt-count">${pl.item_count ?? 0}</span></div>
      <span class="pl-opt-icon" id="icon-${pl.id}">+</span>
    </div>`).join('')
  list.querySelectorAll('.playlist-option').forEach(el => {
    el.addEventListener('click', () => saveToPlaylist(el.dataset.id))
  })
}

function renderMyPlaylists() {
  const list = $('#my-playlists-list')
  if (!list) return
  if (!playlists.length) { list.innerHTML = `<p style="color:var(--t3);font-size:12px;padding:6px 0">No playlists yet.</p>`; return }
  list.innerHTML = playlists.slice(0,5).map(pl => `
    <div class="pl-row" data-id="${pl.id}">
      <span class="pl-row-title">${esc(pl.title)}</span>
      <span class="pl-row-count">${pl.item_count ?? 0} items</span>
    </div>`).join('')
  list.querySelectorAll('.pl-row').forEach(el => {
    el.addEventListener('click', async () => {
      const url = await msg('GET_WEBAPP_URL')
      chrome.tabs.create({ url: `${url}/playlist/${el.dataset.id}` })
    })
  })
}

async function saveToPlaylist(playlistId) {
  if (!currentTabInfo) return
  const icon = $(`#icon-${playlistId}`)
  const opt = $(`.playlist-option[data-id="${playlistId}"]`)
  if (icon?.textContent === '✓') return
  if (opt) opt.classList.add('saving')
  if (icon) icon.textContent = '…'
  await msg('SET_DEFAULT_PLAYLIST', { playlistId })
  const res = await msg('SAVE_ITEM_TO_PLAYLIST', { playlistId, item: currentTabInfo })
  if (opt) opt.classList.remove('saving')
  if (res?.success) { if (opt) opt.classList.add('saved'); if (icon) icon.textContent = '✓' }
  else { if (icon) icon.textContent = '!'; setTimeout(() => { if (icon) icon.textContent = '+' }, 2000) }
}

// Auth events — matching your old popup.js pattern exactly
$('#signin-btn').addEventListener('click', async () => {
  const email = $('#email').value.trim(), password = $('#password').value
  if (!email || !password) return showMsgAuth('Fill in all fields.', 'error')
  $('#signin-btn').textContent = 'Signing in…'; $('#signin-btn').disabled = true
  const res = await msg('SIGN_IN', { email, password })
  $('#signin-btn').textContent = 'Sign In'; $('#signin-btn').disabled = false
  if (res?.success) { showMsgAuth(''); await showMain(res.user) }
  else showMsgAuth(res?.error || 'Sign in failed', 'error')
})

$('#signup-btn').addEventListener('click', async () => {
  const username = $('#reg-username').value.trim(), email = $('#reg-email').value.trim(), password = $('#reg-password').value
  if (!username || !email || !password) return showMsgAuth('Fill in all fields.', 'error')
  if (password.length < 6) return showMsgAuth('Password must be 6+ characters.', 'error')
  $('#signup-btn').textContent = 'Creating…'; $('#signup-btn').disabled = true
  const res = await msg('SIGN_UP', { email, password, username })
  $('#signup-btn').textContent = 'Create Account'; $('#signup-btn').disabled = false
  if (res?.success && res?.needsConfirmation) showMsgAuth('Check your email to confirm, then sign in.', 'success')
  else if (res?.success) { showMsgAuth(''); await showMain(res.user) }
  else showMsgAuth(res?.error || 'Sign up failed', 'error')
})

$('#signout-btn').addEventListener('click', async () => { await msg('SIGN_OUT'); playlists = []; currentTabInfo = null; showAuth() })
$('#show-signup').addEventListener('click', () => { showMsgAuth(''); $('#signin-form').style.display='none'; $('#signup-form').style.display='block' })
$('#show-signin').addEventListener('click', () => { showMsgAuth(''); $('#signup-form').style.display='none'; $('#signin-form').style.display='block' })
$('#password').addEventListener('keydown', e => { if (e.key === 'Enter') $('#signin-btn').click() })
$('#reg-password').addEventListener('keydown', e => { if (e.key === 'Enter') $('#signup-btn').click() })

$('#new-playlist-btn').addEventListener('click', () => {
  $('#new-pl-title').value=''; $('#new-pl-error').style.display='none'
  $('#create-pl-btn').disabled=false; $('#create-pl-btn').textContent='Create'
  $('#new-playlist-modal').style.display='flex'
  setTimeout(() => $('#new-pl-title').focus(), 50)
})
$('#close-modal-btn').addEventListener('click', () => { $('#new-playlist-modal').style.display='none' })
$('#cancel-modal-btn').addEventListener('click', () => { $('#new-playlist-modal').style.display='none' })
$('#new-pl-title').addEventListener('keydown', e => { if (e.key === 'Enter') $('#create-pl-btn').click() })

$('#create-pl-btn').addEventListener('click', async () => {
  const title = $('#new-pl-title').value.trim(); if (!title) return
  $('#create-pl-btn').disabled=true; $('#create-pl-btn').textContent='Creating…'
  const res = await msg('CREATE_PLAYLIST', { title, isPublic: true })
  if (res?.success) {
    playlists.unshift(res.playlist); renderMyPlaylists(); renderSaveTo()
    await msg('SET_DEFAULT_PLAYLIST', { playlistId: res.playlist.id })
    $('#new-playlist-modal').style.display='none'
    if (currentTabInfo) saveToPlaylist(res.playlist.id)
  } else {
    $('#new-pl-error').textContent = res?.error || 'Failed'; $('#new-pl-error').style.display='block'
    $('#create-pl-btn').disabled=false; $('#create-pl-btn').textContent='Create'
  }
})

function showMsgAuth(text, type='') {
  const el = $('#auth-msg'); if (!el) return
  el.textContent = text; el.className = `auth-msg ${type}`; el.style.display = text ? 'block' : 'none'
}
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

init()
