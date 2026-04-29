// FlixList — Content Script (Netflix-native styling)
;(function () {
  let currentUrl = ''
  let injected = false
  let keepAliveInterval = null

  setInterval(() => { if (window.location.href !== currentUrl) { currentUrl = window.location.href; onNavigate() } }, 800)
  currentUrl = window.location.href
  setTimeout(onNavigate, 500)

  function isWatchPage() { return /netflix\.com\/watch\//.test(window.location.href) }
  function onNavigate() { if (!injected) inject() }

  function getNetflixInfo() {
    const url = window.location.href
    const match = url.match(/watch\/(\d+)/)
    const netflixId = match ? match[1] : null
    let title = ''
    for (const sel of ['[data-uia="video-title"]','[data-uia="player-title"]','.ellipsize-text']) {
      const el = document.querySelector(sel)
      if (el?.textContent?.trim()) { title = el.textContent.trim(); break }
    }
    let season = null, episode = null
    const ep = document.title.match(/S(\d+)[:\s]*E(\d+)/i) || document.title.match(/Season\s*(\d+).*Episode\s*(\d+)/i)
    if (ep) { season = parseInt(ep[1]); episode = parseInt(ep[2]) }
    if (!title) title = document.title.replace(/\s*\|?\s*Netflix\s*$/i, '').replace(/^\s*Watch\s*/i, '').trim() || `Netflix ${netflixId || 'moment'}`
    return { netflixId, netflixUrl: url, title, season, episode }
  }

  function startKeepAlive() { stopKeepAlive(); keepAliveInterval = setInterval(() => { document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true })) }, 2000) }
  function stopKeepAlive() { if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null } }

  // Generate a deterministic hue from a string
  function strHue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return ((h % 360) + 360) % 360 }

  function inject() {
    if (document.getElementById('fl-root')) return
    injected = true

    const root = document.createElement('div')
    root.id = 'fl-root'
    root.innerHTML = `
      <button id="fl-toggle" title="FlixList"><span class="fl-toggle-text">FLIXLIST</span></button>

      <div id="fl-panel" class="fl-hidden">
        <div class="fl-chrome">
          <div class="fl-brand">FLIXLIST</div>
          <button id="fl-close" class="fl-close-btn">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path fill-rule="evenodd" d="M10.586 12 2.293 3.707l1.414-1.414L12 10.586l8.293-8.293 1.414 1.414L13.414 12l8.293 8.293-1.414 1.414L12 13.414l-8.293 8.293-1.414-1.414z" clip-rule="evenodd"/></svg>
          </button>
        </div>

        <div id="fl-body">
          <!-- Auth gate -->
          <div id="fl-auth-gate" style="display:none">
            <div class="fl-empty">Sign in via the FlixList extension icon (top-right of browser) to use playlists.</div>
          </div>

          <!-- Main content -->
          <div id="fl-main" style="display:none">

            <!-- Save current moment (watch pages only) -->
            <div id="fl-save-section" style="display:none">
              <div class="fl-section-head">Save This Moment</div>
              <div id="fl-save-now-playing" class="fl-now-playing"></div>
              <div id="fl-save-chips"></div>
              <div id="fl-save-status" class="fl-status"></div>
            </div>

            <!-- Playlist list view -->
            <div id="fl-list-view">
              <div class="fl-section-head">My Playlists</div>
              <div id="fl-playlists"></div>
              <div class="fl-create-row">
                <input id="fl-new-input" class="fl-input" placeholder="New playlist name…" />
                <button id="fl-new-btn" class="fl-btn-primary fl-btn-sm">Create</button>
              </div>
            </div>

            <!-- Playlist detail view (episodes-style) -->
            <div id="fl-detail" style="display:none">
              <button id="fl-back" class="fl-back">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6.414 12 15.7 2.707l-1.414-1.414-10 10a1 1 0 0 0 0 1.414l10 10 1.414-1.414z"/></svg>
                Back to playlists
              </button>
              <div id="fl-detail-title" class="fl-detail-title"></div>
              <div id="fl-detail-items"></div>
            </div>

          </div>
        </div>
      </div>
    `
    document.body.appendChild(root)

    // Block keyboard events from reaching Netflix
    root.addEventListener('keydown', e => e.stopPropagation(), true)
    root.addEventListener('keyup', e => e.stopPropagation(), true)
    root.addEventListener('keypress', e => e.stopPropagation(), true)

    const toggle = document.getElementById('fl-toggle')
    const panel = document.getElementById('fl-panel')
    let panelOpen = false

    toggle.addEventListener('click', e => { e.stopPropagation(); panelOpen ? closeP() : openP() })
    document.getElementById('fl-close').addEventListener('click', e => { e.stopPropagation(); closeP() })
    document.addEventListener('click', e => { if (panelOpen && !root.contains(e.target)) closeP() })
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closeP() })

    async function openP() {
      panelOpen = true; panel.classList.remove('fl-hidden'); toggle.classList.add('fl-active')
      startKeepAlive()
      const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
      if (!user) {
        document.getElementById('fl-auth-gate').style.display = 'block'
        document.getElementById('fl-main').style.display = 'none'
        return
      }
      document.getElementById('fl-auth-gate').style.display = 'none'
      document.getElementById('fl-main').style.display = 'block'
      showList()
    }
    function closeP() { panelOpen = false; panel.classList.add('fl-hidden'); toggle.classList.remove('fl-active'); stopKeepAlive() }

    // ─── Playlist list ────────────────────────────
    async function showList() {
      const listView = document.getElementById('fl-list-view')
      const detail = document.getElementById('fl-detail')
      const saveSection = document.getElementById('fl-save-section')
      listView.style.display = 'block'; detail.style.display = 'none'

      const listEl = document.getElementById('fl-playlists')
      listEl.innerHTML = '<div class="fl-loading">Loading playlists…</div>'

      const playlists = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' })

      if (playlists?.error) {
        const msg = (playlists.error.includes('expired') || playlists.error.includes('sign in'))
          ? 'Session expired — sign in again via the extension popup.'
          : playlists.error
        listEl.innerHTML = `<div class="fl-empty">${esc(msg)}</div>`
        saveSection.style.display = 'none'
        return
      }

      if (!playlists?.length) {
        listEl.innerHTML = '<div class="fl-empty">No playlists yet.<br>Create one below to start saving moments.</div>'
      } else {
        listEl.innerHTML = ''
        playlists.forEach(p => {
          const count = p.playlist_items?.[0]?.count ?? 0
          const hue = strHue(p.title)
          const card = document.createElement('button')
          card.className = 'fl-card'
          card.innerHTML = `
            <div class="fl-card-art" style="background: linear-gradient(135deg, hsl(${hue},30%,18%), hsl(${(hue+40)%360},25%,12%));">
              <div class="fl-card-play">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M5 2.7a1 1 0 0 1 1.48-.88l16.93 9.3a1 1 0 0 1 0 1.76l-16.93 9.3A1 1 0 0 1 5 21.31z"/></svg>
              </div>
              <div class="fl-card-count">${count} item${count !== 1 ? 's' : ''}</div>
            </div>
            <div class="fl-card-meta">
              <div class="fl-card-title">${esc(p.title)}</div>
            </div>
          `
          card.addEventListener('click', () => showDetail(p.id, p.title))
          listEl.appendChild(card)
        })
      }

      // Save section on watch pages
      if (isWatchPage() && playlists && !playlists.error) {
        saveSection.style.display = 'block'
        const info = getNetflixInfo()
        document.getElementById('fl-save-now-playing').textContent = info.title + (info.season ? ` · S${info.season}E${info.episode}` : '')
        const chips = document.getElementById('fl-save-chips')
        chips.innerHTML = ''
        if (playlists.length) {
          playlists.forEach(p => {
            const chip = document.createElement('button')
            chip.className = 'fl-chip'
            chip.textContent = p.title
            chip.addEventListener('click', async (ev) => {
              ev.stopPropagation(); chip.textContent = '…'; chip.disabled = true
              await doSave(p.id, p.title, info)
              chip.textContent = p.title; chip.disabled = false
            })
            chips.appendChild(chip)
          })
        } else {
          chips.innerHTML = '<div class="fl-muted">Create a playlist first.</div>'
        }
      } else {
        saveSection.style.display = 'none'
      }
    }

    async function doSave(pid, pname, info) {
      const st = document.getElementById('fl-save-status')
      st.textContent = 'Saving…'; st.className = 'fl-status'
      try {
        const r = await chrome.runtime.sendMessage({
          type: 'ADD_TO_PLAYLIST', playlistId: pid,
          item: { netflix_id: info.netflixId, netflix_url: info.netflixUrl, title: info.title, season: info.season, episode: info.episode }
        })
        if (r?.error) { st.textContent = r.error; st.className = 'fl-status fl-status-err' }
        else { st.textContent = `✓ Added to "${pname}"`; st.className = 'fl-status fl-status-ok' }
      } catch { st.textContent = 'Error saving'; st.className = 'fl-status fl-status-err' }
      setTimeout(() => { st.textContent = '' }, 3000)
    }

    // ─── Detail (episode cards) ───────────────────
    async function showDetail(playlistId, title) {
      document.getElementById('fl-list-view').style.display = 'none'
      document.getElementById('fl-save-section').style.display = 'none'
      const detail = document.getElementById('fl-detail')
      detail.style.display = 'block'
      document.getElementById('fl-detail-title').textContent = title
      const itemsEl = document.getElementById('fl-detail-items')
      itemsEl.innerHTML = '<div class="fl-loading">Loading…</div>'

      const items = await chrome.runtime.sendMessage({ type: 'GET_PLAYLIST_ITEMS', playlistId })
      if (!items?.length || items.error) {
        itemsEl.innerHTML = `<div class="fl-empty">${items?.error || 'No moments saved yet.'}</div>`
        return
      }

      itemsEl.innerHTML = ''
      items.forEach((item, i) => {
        const hue = strHue(item.title + i)
        const epTag = item.season ? `S${item.season}:E${item.episode || '?'}` : ''
        const watchUrl = item.netflix_url || (item.netflix_id ? `https://www.netflix.com/watch/${item.netflix_id}` : null)

        const row = document.createElement('div')
        row.className = 'fl-ep-row'
        row.innerHTML = `
          <div class="fl-ep-num">${i + 1}</div>
          <div class="fl-ep-thumb" style="background: linear-gradient(135deg, hsl(${hue},25%,22%), hsl(${(hue+60)%360},20%,14%));">
            ${watchUrl ? `<div class="fl-ep-play"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M5 2.7a1 1 0 0 1 1.48-.88l16.93 9.3a1 1 0 0 1 0 1.76l-16.93 9.3A1 1 0 0 1 5 21.31z"/></svg></div>` : ''}
          </div>
          <div class="fl-ep-info">
            <div class="fl-ep-title-row">
              <span class="fl-ep-name">${esc(item.title)}</span>
            </div>
            <div class="fl-ep-meta">
              ${epTag ? `<span class="fl-ep-tag">${epTag}</span>` : ''}
              ${item.note ? `<span class="fl-ep-note">${esc(item.note)}</span>` : ''}
            </div>
          </div>
        `
        if (watchUrl) {
          row.style.cursor = 'pointer'
          row.addEventListener('click', () => { window.location.href = watchUrl; closeP() })
        }

        // Rename on double-click
        const nameEl = row.querySelector('.fl-ep-name')
        nameEl.addEventListener('dblclick', (e) => {
          e.stopPropagation()
          const old = item.title
          nameEl.innerHTML = `<input class="fl-rename-input" value="${esc(old)}" />`
          const inp = nameEl.querySelector('input')
          inp.focus(); inp.select()
          const save = async () => {
            const nv = inp.value.trim()
            if (nv && nv !== old) {
              await chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', itemId: item.id, updates: { title: nv } })
              item.title = nv
            }
            nameEl.textContent = item.title
          }
          inp.addEventListener('blur', save)
          inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = old; inp.blur() } })
        })

        itemsEl.appendChild(row)
      })
    }

    document.getElementById('fl-back').addEventListener('click', () => showList())

    // New playlist
    const ni = document.getElementById('fl-new-input'), nb = document.getElementById('fl-new-btn')
    nb.addEventListener('click', async () => {
      const t = ni.value.trim(); if (!t) return
      nb.textContent = '…'; nb.disabled = true
      try { await chrome.runtime.sendMessage({ type: 'CREATE_PLAYLIST', title: t }); ni.value = ''; await showList() }
      catch (e) { console.error('FlixList:', e) }
      nb.textContent = 'Create'; nb.disabled = false
    })
    ni.addEventListener('keydown', e => { if (e.key === 'Enter') nb.click() })

    onNavigate()
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML }
})()
