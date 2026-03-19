// FlixList — Content Script
// Injects a FlixList button on Netflix that opens a playlist panel overlay.
// Works on all Netflix pages. On /watch/ pages, also shows "Save to Playlist".

;(function () {
  let currentUrl = ''
  let injected = false

  // ─── SPA navigation detection ───────────────────
  setInterval(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href
      onNavigate()
    }
  }, 800)
  currentUrl = window.location.href
  setTimeout(onNavigate, 500)

  function isWatchPage() {
    return /netflix\.com\/watch\//.test(window.location.href)
  }

  function onNavigate() {
    if (!injected) inject()
    // Show/hide "Save" button based on page type
    const saveSection = document.getElementById('fl-save-section')
    if (saveSection) {
      saveSection.style.display = isWatchPage() ? 'block' : 'none'
    }
  }

  // ─── Get info about current Netflix video ───────
  function getNetflixInfo() {
    const url = window.location.href
    const match = url.match(/watch\/(\d+)/)
    const netflixId = match ? match[1] : null
    let title = ''
    for (const sel of ['[data-uia="video-title"]', '[data-uia="player-title"]', '.ellipsize-text']) {
      const el = document.querySelector(sel)
      if (el?.textContent?.trim()) { title = el.textContent.trim(); break }
    }
    let season = null, episode = null
    const epMatch = document.title.match(/S(\d+)[:\s]*E(\d+)/i) || document.title.match(/Season\s*(\d+).*Episode\s*(\d+)/i)
    if (epMatch) { season = parseInt(epMatch[1]); episode = parseInt(epMatch[2]) }
    if (!title) title = document.title.replace(/\s*\|?\s*Netflix\s*$/i, '').replace(/^\s*Watch\s*/i, '').trim() || `Netflix ${netflixId || 'moment'}`
    return { netflixId, netflixUrl: url, title, season, episode }
  }

  // ─── Main injection ─────────────────────────────
  function inject() {
    if (document.getElementById('fl-root')) return
    injected = true

    const root = document.createElement('div')
    root.id = 'fl-root'
    root.innerHTML = `
      <button id="fl-toggle" title="FlixList">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="3"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>
        <span>FlixList</span>
      </button>

      <div id="fl-panel" class="fl-hidden">
        <div id="fl-panel-header">
          <div id="fl-panel-title">FlixList</div>
          <button id="fl-close" title="Close">&times;</button>
        </div>

        <div id="fl-auth-gate" style="display:none">
          <p class="fl-empty-msg">Sign in via the FlixList extension popup to use playlists.</p>
        </div>

        <div id="fl-main" style="display:none">
          <!-- Save section: only visible on /watch/ pages -->
          <div id="fl-save-section" style="display:none">
            <div class="fl-section-label">Save this moment</div>
            <div id="fl-save-info" class="fl-save-info"></div>
            <div id="fl-save-list"></div>
            <div id="fl-save-status" class="fl-save-status"></div>
          </div>

          <div class="fl-divider" id="fl-divider-save" style="display:none"></div>

          <!-- Playlists browser -->
          <div class="fl-section-label">Your Playlists</div>
          <div id="fl-playlists-list"></div>
          <div id="fl-new-playlist" class="fl-new-row">
            <input id="fl-new-input" placeholder="New playlist…" />
            <button id="fl-new-btn">+</button>
          </div>

          <!-- Playlist detail view (items) -->
          <div id="fl-detail" style="display:none">
            <button id="fl-back" class="fl-back-btn">&larr; Back</button>
            <div id="fl-detail-title" class="fl-detail-title"></div>
            <div id="fl-detail-items"></div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(root)

    // ─── Wire events ──────────────────────────────
    const toggle = document.getElementById('fl-toggle')
    const panel = document.getElementById('fl-panel')
    const closeBtn = document.getElementById('fl-close')
    let panelOpen = false

    toggle.addEventListener('click', e => { e.stopPropagation(); togglePanel() })
    closeBtn.addEventListener('click', e => { e.stopPropagation(); closePanel() })
    document.addEventListener('click', e => { if (panelOpen && !root.contains(e.target)) closePanel() })
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closePanel() })

    function togglePanel() { panelOpen ? closePanel() : openPanel() }

    async function openPanel() {
      panelOpen = true
      panel.classList.remove('fl-hidden')
      toggle.classList.add('fl-active')

      const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
      if (!user) {
        document.getElementById('fl-auth-gate').style.display = 'block'
        document.getElementById('fl-main').style.display = 'none'
        return
      }
      document.getElementById('fl-auth-gate').style.display = 'none'
      document.getElementById('fl-main').style.display = 'block'

      showPlaylistsList()
    }

    function closePanel() {
      panelOpen = false
      panel.classList.add('fl-hidden')
      toggle.classList.remove('fl-active')
    }

    // ─── Show playlists list ──────────────────────
    async function showPlaylistsList() {
      const listEl = document.getElementById('fl-playlists-list')
      const saveList = document.getElementById('fl-save-list')
      const detail = document.getElementById('fl-detail')
      detail.style.display = 'none'
      listEl.innerHTML = '<div class="fl-loading">Loading…</div>'

      const playlists = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' })

      if (playlists?.error) {
        listEl.innerHTML = `<div class="fl-empty-msg">Error: ${playlists.error}</div>`
        return
      }

      // Main playlists list
      if (!playlists?.length) {
        listEl.innerHTML = '<div class="fl-empty-msg">No playlists yet. Create one below.</div>'
      } else {
        listEl.innerHTML = ''
        playlists.forEach(p => {
          const count = p.playlist_items?.[0]?.count ?? 0
          const el = document.createElement('button')
          el.className = 'fl-playlist-row'
          el.innerHTML = `<span class="fl-playlist-name">${esc(p.title)}</span><span class="fl-playlist-count">${count}</span>`
          el.addEventListener('click', () => showPlaylistDetail(p.id, p.title))
          listEl.appendChild(el)
        })
      }

      // Save section (on watch pages)
      if (isWatchPage()) {
        document.getElementById('fl-save-section').style.display = 'block'
        document.getElementById('fl-divider-save').style.display = 'block'
        const info = getNetflixInfo()
        document.getElementById('fl-save-info').textContent = info.title + (info.season ? ` S${info.season}E${info.episode}` : '')

        saveList.innerHTML = ''
        if (playlists?.length) {
          playlists.forEach(p => {
            const btn = document.createElement('button')
            btn.className = 'fl-save-btn'
            btn.textContent = p.title
            btn.addEventListener('click', () => saveToPl(p.id, p.title, info))
            saveList.appendChild(btn)
          })
        } else {
          saveList.innerHTML = '<div class="fl-empty-msg" style="padding:4px 0">Create a playlist first</div>'
        }
      } else {
        document.getElementById('fl-save-section').style.display = 'none'
        document.getElementById('fl-divider-save').style.display = 'none'
      }
    }

    async function saveToPl(playlistId, playlistTitle, info) {
      const statusEl = document.getElementById('fl-save-status')
      statusEl.textContent = 'Saving…'
      statusEl.className = 'fl-save-status'
      try {
        const result = await chrome.runtime.sendMessage({
          type: 'ADD_TO_PLAYLIST', playlistId,
          item: { netflix_id: info.netflixId, netflix_url: info.netflixUrl, title: info.title, season: info.season, episode: info.episode },
        })
        if (result?.error) { statusEl.textContent = 'Error: ' + result.error; statusEl.className = 'fl-save-status fl-error' }
        else { statusEl.textContent = `Saved to "${playlistTitle}"!`; statusEl.className = 'fl-save-status fl-success' }
      } catch { statusEl.textContent = 'Error saving'; statusEl.className = 'fl-save-status fl-error' }
      setTimeout(() => { statusEl.textContent = '' }, 3000)
    }

    // ─── Playlist detail with items ───────────────
    async function showPlaylistDetail(playlistId, title) {
      const detail = document.getElementById('fl-detail')
      const plList = document.getElementById('fl-playlists-list')
      const newRow = document.getElementById('fl-new-playlist')
      const saveSection = document.getElementById('fl-save-section')
      const divider = document.getElementById('fl-divider-save')

      plList.style.display = 'none'
      newRow.style.display = 'none'
      saveSection.style.display = 'none'
      divider.style.display = 'none'
      detail.style.display = 'block'

      document.getElementById('fl-detail-title').textContent = title
      const itemsEl = document.getElementById('fl-detail-items')
      itemsEl.innerHTML = '<div class="fl-loading">Loading…</div>'

      const items = await chrome.runtime.sendMessage({ type: 'GET_PLAYLIST_ITEMS', playlistId })

      if (!items?.length) {
        itemsEl.innerHTML = '<div class="fl-empty-msg">No moments saved yet.</div>'
        return
      }

      itemsEl.innerHTML = ''
      items.forEach((item, i) => {
        const el = document.createElement('div')
        el.className = 'fl-item-row'
        const epTag = item.season ? ` <span class="fl-ep">S${item.season}E${item.episode || '?'}</span>` : ''
        const watchUrl = item.netflix_url || (item.netflix_id ? `https://www.netflix.com/watch/${item.netflix_id}` : null)

        el.innerHTML = `
          <span class="fl-item-num">${i + 1}</span>
          <div class="fl-item-info">
            <div class="fl-item-title">${esc(item.title)}${epTag}</div>
            ${item.note ? `<div class="fl-item-note">${esc(item.note)}</div>` : ''}
          </div>
          ${watchUrl ? `<a href="${watchUrl}" class="fl-watch-btn" title="Watch on Netflix">▶</a>` : ''}
        `
        el.querySelector('.fl-watch-btn')?.addEventListener('click', e => {
          e.stopPropagation()
          // Navigate within Netflix SPA
          window.location.href = watchUrl
          closePanel()
        })
        itemsEl.appendChild(el)
      })
    }

    // Back button
    document.getElementById('fl-back').addEventListener('click', () => {
      document.getElementById('fl-detail').style.display = 'none'
      document.getElementById('fl-playlists-list').style.display = ''
      document.getElementById('fl-new-playlist').style.display = ''
      showPlaylistsList()
    })

    // Create new playlist
    const newInput = document.getElementById('fl-new-input')
    const newBtn = document.getElementById('fl-new-btn')
    newBtn.addEventListener('click', async () => {
      const title = newInput.value.trim()
      if (!title) return
      newBtn.textContent = '…'
      try {
        await chrome.runtime.sendMessage({ type: 'CREATE_PLAYLIST', title })
        newInput.value = ''
        await showPlaylistsList()
      } catch (err) { console.error('FlixList:', err) }
      newBtn.textContent = '+'
    })
    newInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') newBtn.click() })
    newInput.addEventListener('keyup', e => e.stopPropagation())
    newInput.addEventListener('keypress', e => e.stopPropagation())

    // Initial page check
    onNavigate()
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML }
})()
