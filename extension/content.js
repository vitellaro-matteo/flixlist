// FlixList — Content Script
;(function () {
  let currentUrl = ''
  let injected = false

  setInterval(() => {
    if (window.location.href !== currentUrl) { currentUrl = window.location.href; onNavigate() }
  }, 800)
  currentUrl = window.location.href
  setTimeout(onNavigate, 500)

  function isWatchPage() { return /netflix\.com\/watch\//.test(window.location.href) }

  function onNavigate() {
    if (!injected) inject()
    const s = document.getElementById('fl-save-section')
    const d = document.getElementById('fl-divider-save')
    if (s) s.style.display = isWatchPage() ? 'block' : 'none'
    if (d) d.style.display = isWatchPage() ? 'block' : 'none'
  }

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
    if (!title) title = document.title.replace(/\s*\|?\s*Netflix\s*$/i,'').replace(/^\s*Watch\s*/i,'').trim() || `Netflix ${netflixId||'moment'}`
    return { netflixId, netflixUrl: url, title, season, episode }
  }

  function inject() {
    if (document.getElementById('fl-root')) return
    injected = true

    const root = document.createElement('div')
    root.id = 'fl-root'
    root.innerHTML = `
      <button id="fl-toggle" title="FlixList playlists">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
      </button>
      <div id="fl-panel" class="fl-hidden">
        <div id="fl-panel-header">
          <div id="fl-panel-title">FlixList</div>
          <button id="fl-close">&times;</button>
        </div>
        <div id="fl-auth-gate" style="display:none">
          <p class="fl-empty-msg">Sign in via the FlixList extension popup (top-right of your browser) to use playlists.</p>
        </div>
        <div id="fl-main" style="display:none">
          <div id="fl-save-section" style="display:none">
            <div class="fl-section-label">Save this moment</div>
            <div id="fl-save-info" class="fl-save-info"></div>
            <div id="fl-save-list"></div>
            <div id="fl-save-status" class="fl-save-status"></div>
          </div>
          <div class="fl-divider" id="fl-divider-save" style="display:none"></div>
          <div id="fl-list-view">
            <div class="fl-section-label">Your Playlists</div>
            <div id="fl-playlists-list"></div>
            <div id="fl-new-playlist" class="fl-new-row">
              <input id="fl-new-input" placeholder="New playlist…" />
              <button id="fl-new-btn">+</button>
            </div>
          </div>
          <div id="fl-detail" style="display:none">
            <button id="fl-back" class="fl-back-btn">&larr; Back</button>
            <div id="fl-detail-title" class="fl-detail-title"></div>
            <div id="fl-detail-items"></div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(root)

    const toggle = document.getElementById('fl-toggle')
    const panel = document.getElementById('fl-panel')
    let panelOpen = false

    toggle.addEventListener('click', e => { e.stopPropagation(); panelOpen ? closeP() : openP() })
    document.getElementById('fl-close').addEventListener('click', e => { e.stopPropagation(); closeP() })
    document.addEventListener('click', e => { if (panelOpen && !root.contains(e.target)) closeP() })
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelOpen) closeP() })

    async function openP() {
      panelOpen = true; panel.classList.remove('fl-hidden'); toggle.classList.add('fl-active')
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
    function closeP() { panelOpen = false; panel.classList.add('fl-hidden'); toggle.classList.remove('fl-active') }

    // ─── Playlists list ───────────────────────────
    async function showList() {
      const listView = document.getElementById('fl-list-view')
      const detail = document.getElementById('fl-detail')
      listView.style.display = 'block'; detail.style.display = 'none'
      const listEl = document.getElementById('fl-playlists-list')
      listEl.innerHTML = '<div class="fl-loading">Loading…</div>'

      const playlists = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' })

      if (playlists?.error) {
        if (playlists.error.includes('expired') || playlists.error.includes('401')) {
          listEl.innerHTML = '<div class="fl-empty-msg">Session expired. Open the extension popup to sign in again.</div>'
        } else {
          listEl.innerHTML = `<div class="fl-empty-msg">${esc(playlists.error)}</div>`
        }
        return
      }

      if (!playlists?.length) {
        listEl.innerHTML = '<div class="fl-empty-msg">No playlists yet. Create one below.</div>'
      } else {
        listEl.innerHTML = ''
        playlists.forEach(p => {
          const count = p.playlist_items?.[0]?.count ?? 0
          const el = document.createElement('button')
          el.className = 'fl-playlist-row'
          el.innerHTML = `<span class="fl-playlist-name">${esc(p.title)}</span><span class="fl-playlist-count">${count}</span>`
          el.addEventListener('click', () => showDetail(p.id, p.title))
          listEl.appendChild(el)
        })
      }

      // Save pills on watch pages
      const saveList = document.getElementById('fl-save-list')
      if (isWatchPage()) {
        const info = getNetflixInfo()
        document.getElementById('fl-save-info').textContent = info.title + (info.season ? ` S${info.season}E${info.episode}` : '')
        saveList.innerHTML = ''
        if (playlists?.length) {
          playlists.forEach(p => {
            const b = document.createElement('button'); b.className = 'fl-save-btn'; b.textContent = p.title
            b.addEventListener('click', () => doSave(p.id, p.title, info)); saveList.appendChild(b)
          })
        }
      }
    }

    async function doSave(pid, pname, info) {
      const st = document.getElementById('fl-save-status')
      st.textContent = 'Saving…'; st.className = 'fl-save-status'
      try {
        const r = await chrome.runtime.sendMessage({ type:'ADD_TO_PLAYLIST', playlistId:pid,
          item:{ netflix_id:info.netflixId, netflix_url:info.netflixUrl, title:info.title, season:info.season, episode:info.episode }})
        if (r?.error) { st.textContent = 'Error'; st.className = 'fl-save-status fl-error' }
        else { st.textContent = `Saved to "${pname}"`; st.className = 'fl-save-status fl-success' }
      } catch { st.textContent = 'Error'; st.className = 'fl-save-status fl-error' }
      setTimeout(() => { st.textContent = '' }, 3000)
    }

    // ─── Detail view with rename ──────────────────
    async function showDetail(playlistId, title) {
      document.getElementById('fl-list-view').style.display = 'none'
      document.getElementById('fl-save-section').style.display = 'none'
      document.getElementById('fl-divider-save').style.display = 'none'
      const detail = document.getElementById('fl-detail')
      detail.style.display = 'block'
      document.getElementById('fl-detail-title').textContent = title
      const itemsEl = document.getElementById('fl-detail-items')
      itemsEl.innerHTML = '<div class="fl-loading">Loading…</div>'

      const items = await chrome.runtime.sendMessage({ type: 'GET_PLAYLIST_ITEMS', playlistId })
      if (!items?.length || items.error) {
        itemsEl.innerHTML = `<div class="fl-empty-msg">${items?.error || 'No moments yet.'}</div>`
        return
      }

      itemsEl.innerHTML = ''
      items.forEach((item, i) => {
        const el = document.createElement('div'); el.className = 'fl-item-row'
        const epTag = item.season ? ` <span class="fl-ep">S${item.season}E${item.episode||'?'}</span>` : ''
        const watchUrl = item.netflix_url || (item.netflix_id ? `https://www.netflix.com/watch/${item.netflix_id}` : null)

        el.innerHTML = `
          <span class="fl-item-num">${i+1}</span>
          <div class="fl-item-info">
            <div class="fl-item-title" data-id="${item.id}">${esc(item.title)}${epTag}</div>
            ${item.note ? `<div class="fl-item-note">${esc(item.note)}</div>` : ''}
          </div>
          <div class="fl-item-actions">
            <button class="fl-rename-btn" title="Rename">✎</button>
            ${watchUrl ? `<a href="${watchUrl}" class="fl-watch-btn" title="Watch">▶</a>` : ''}
          </div>
        `
        // Watch button
        el.querySelector('.fl-watch-btn')?.addEventListener('click', e => {
          e.preventDefault(); e.stopPropagation(); window.location.href = watchUrl; closeP()
        })
        // Rename
        el.querySelector('.fl-rename-btn').addEventListener('click', e => {
          e.stopPropagation()
          const titleEl = el.querySelector('.fl-item-title')
          const oldText = item.title
          titleEl.innerHTML = `<input class="fl-rename-input" value="${esc(oldText)}" />`
          const inp = titleEl.querySelector('input')
          inp.focus(); inp.select()
          const save = async () => {
            const newTitle = inp.value.trim()
            if (newTitle && newTitle !== oldText) {
              await chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', itemId: item.id, updates: { title: newTitle } })
              item.title = newTitle
            }
            titleEl.innerHTML = esc(item.title) + epTag
          }
          inp.addEventListener('blur', save)
          inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = oldText; inp.blur() } })
          inp.addEventListener('keyup', ev => ev.stopPropagation())
          inp.addEventListener('keypress', ev => ev.stopPropagation())
        })
        itemsEl.appendChild(el)
      })
    }

    document.getElementById('fl-back').addEventListener('click', () => { showList() })

    // New playlist
    const ni = document.getElementById('fl-new-input'), nb = document.getElementById('fl-new-btn')
    nb.addEventListener('click', async () => {
      const t = ni.value.trim(); if (!t) return; nb.textContent = '…'
      try { await chrome.runtime.sendMessage({ type:'CREATE_PLAYLIST', title:t }); ni.value = ''; await showList() }
      catch(e) { console.error('FlixList:', e) }
      nb.textContent = '+'
    })
    ni.addEventListener('keydown', e => { e.stopPropagation(); if (e.key==='Enter') nb.click() })
    ni.addEventListener('keyup', e => e.stopPropagation())
    ni.addEventListener('keypress', e => e.stopPropagation())

    onNavigate()
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s||''; return d.innerHTML }
})()
