// FlixList — Content Script v2
// Injects as a native Netflix row on browse pages, save button on watch pages.
;(function () {
  let currentUrl = ''
  let rowInjected = false
  let watchInjected = false
  let keepAlive = null

  // ─── SPA detection ──────────────────────────────
  setInterval(() => { if (window.location.href !== currentUrl) { currentUrl = window.location.href; onNavigate() } }, 800)
  currentUrl = window.location.href
  setTimeout(onNavigate, 1000)

  function isBrowse() { return /netflix\.com\/(browse|latest|my-list|search)/.test(window.location.href) || window.location.pathname === '/' }
  function isWatch() { return /netflix\.com\/watch\//.test(window.location.href) }

  function onNavigate() {
    if (isBrowse()) { injectRow(); removeWatch() }
    else if (isWatch()) { injectWatch(); removeRow() }
    else { removeRow(); removeWatch() }
  }

  function startKeepAlive() { stopKeepAlive(); keepAlive = setInterval(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true })), 2000) }
  function stopKeepAlive() { if (keepAlive) { clearInterval(keepAlive); keepAlive = null } }
  function strHue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return ((h % 360) + 360) % 360 }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML }

  function getNetflixInfo() {
    const url = window.location.href, m = url.match(/watch\/(\d+)/), nid = m ? m[1] : null
    let title = ''
    for (const sel of ['[data-uia="video-title"]', '[data-uia="player-title"]', '.ellipsize-text']) { const el = document.querySelector(sel); if (el?.textContent?.trim()) { title = el.textContent.trim(); break } }
    let season = null, episode = null
    const ep = document.title.match(/S(\d+)[:\s]*E(\d+)/i) || document.title.match(/Season\s*(\d+).*Episode\s*(\d+)/i)
    if (ep) { season = parseInt(ep[1]); episode = parseInt(ep[2]) }
    if (!title) title = document.title.replace(/\s*\|?\s*Netflix\s*$/i, '').replace(/^\s*Watch\s*/i, '').trim() || `Netflix ${nid || 'moment'}`
    return { netflixId: nid, netflixUrl: url, title, season, episode }
  }

  // ════════════════════════════════════════════════
  //  BROWSE PAGE — inject playlist row
  // ════════════════════════════════════════════════

  function removeRow() { document.getElementById('fl-row')?.remove(); rowInjected = false }

  async function injectRow() {
    if (rowInjected && document.getElementById('fl-row')) return
    const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
    if (!user) { removeRow(); return }

    removeRow()
    rowInjected = true

    const row = document.createElement('div')
    row.id = 'fl-row'
    row.innerHTML = `
      <h2 class="fl-row-title">My FlixList Playlists</h2>
      <div class="fl-row-slider" id="fl-row-slider">
        <div class="fl-row-loading">Loading playlists…</div>
      </div>
      <div class="fl-row-create">
        <input class="fl-row-input" id="fl-row-input" placeholder="New playlist name…" />
        <button class="fl-row-create-btn" id="fl-row-create-btn">+ Create</button>
      </div>
    `

    // Block Netflix keyboard shortcuts when typing
    row.addEventListener('keydown', e => e.stopPropagation(), true)
    row.addEventListener('keyup', e => e.stopPropagation(), true)
    row.addEventListener('keypress', e => e.stopPropagation(), true)

    // Find Netflix's row container and inject after the first row
    const insertInto = () => {
      const mainView = document.querySelector('.lolomoRow')?.parentElement
        || document.querySelector('[class*="lolomo"]')
        || document.querySelector('main')
        || document.querySelector('.mainView')
      if (mainView && !document.getElementById('fl-row')) {
        // Insert after the second row so it's visible but not at the very top
        const rows = mainView.querySelectorAll(':scope > div')
        if (rows.length > 1) {
          rows[1].after(row)
        } else {
          mainView.prepend(row)
        }
        loadRowPlaylists()
        wireRowCreate()
      }
    }

    insertInto()
    // Netflix loads rows lazily, retry a few times
    if (!document.getElementById('fl-row')) {
      let tries = 0
      const retryInterval = setInterval(() => {
        tries++
        insertInto()
        if (document.getElementById('fl-row') || tries > 15) clearInterval(retryInterval)
      }, 1000)
    }
  }

  async function loadRowPlaylists() {
    const slider = document.getElementById('fl-row-slider')
    if (!slider) return

    const playlists = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' })

    if (playlists?.error) {
      slider.innerHTML = `<div class="fl-row-empty">${esc(playlists.error)}</div>`
      return
    }
    if (!playlists?.length) {
      slider.innerHTML = '<div class="fl-row-empty">No playlists yet. Create one below to start saving moments.</div>'
      return
    }

    slider.innerHTML = ''
    playlists.forEach(p => {
      const count = p.playlist_items?.[0]?.count ?? 0
      const hue = strHue(p.title)
      const card = document.createElement('div')
      card.className = 'fl-title-card'
      card.setAttribute('tabindex', '0')
      card.setAttribute('role', 'button')
      card.setAttribute('aria-label', p.title)
      card.innerHTML = `
        <div class="fl-title-card-image" style="background: linear-gradient(135deg, hsl(${hue},28%,18%) 0%, hsl(${(hue + 50) % 360},22%,10%) 100%);">
          <div class="fl-title-card-overlay">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M5 2.7a1 1 0 0 1 1.48-.88l16.93 9.3a1 1 0 0 1 0 1.76l-16.93 9.3A1 1 0 0 1 5 21.31z"/></svg>
          </div>
          <div class="fl-title-card-badge">${count}</div>
        </div>
        <p class="fl-title-card-name">${esc(p.title)}</p>
      `
      card.addEventListener('click', () => openDetailModal(p.id, p.title))
      slider.appendChild(card)
    })
  }

  function wireRowCreate() {
    const inp = document.getElementById('fl-row-input')
    const btn = document.getElementById('fl-row-create-btn')
    if (!inp || !btn) return
    btn.addEventListener('click', async () => {
      const t = inp.value.trim(); if (!t) return
      btn.textContent = '…'; btn.disabled = true
      try { await chrome.runtime.sendMessage({ type: 'CREATE_PLAYLIST', title: t }); inp.value = ''; await loadRowPlaylists() }
      catch (e) { console.error('FlixList:', e) }
      btn.textContent = '+ Create'; btn.disabled = false
    })
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click() })
  }

  // ════════════════════════════════════════════════
  //  DETAIL MODAL — Netflix previewModal style
  // ════════════════════════════════════════════════

  async function openDetailModal(playlistId, title) {
    closeDetailModal()

    const backdrop = document.createElement('div')
    backdrop.id = 'fl-modal-backdrop'
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeDetailModal() })

    const modal = document.createElement('div')
    modal.id = 'fl-modal'
    modal.innerHTML = `
      <div class="fl-modal-hero">
        <div class="fl-modal-hero-gradient"></div>
        <div class="fl-modal-hero-content">
          <div class="fl-modal-logo">${esc(title)}</div>
          <div class="fl-modal-hero-meta" id="fl-modal-meta"></div>
        </div>
        <button class="fl-modal-close" id="fl-modal-close">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path fill-rule="evenodd" d="M10.586 12 2.293 3.707l1.414-1.414L12 10.586l8.293-8.293 1.414 1.414L13.414 12l8.293 8.293-1.414 1.414L12 13.414l-8.293 8.293-1.414-1.414z" clip-rule="evenodd"/></svg>
        </button>
      </div>
      <div class="fl-modal-body">
        <div class="fl-modal-section-head">Episodes</div>
        <div id="fl-modal-episodes" class="fl-modal-episodes">
          <div class="fl-modal-loading">Loading…</div>
        </div>
      </div>
    `

    // Block Netflix keyboard shortcuts
    modal.addEventListener('keydown', e => e.stopPropagation(), true)
    modal.addEventListener('keyup', e => e.stopPropagation(), true)

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    document.body.style.overflow = 'hidden'

    document.getElementById('fl-modal-close').addEventListener('click', closeDetailModal)
    document.addEventListener('keydown', modalEscHandler)

    // Load items
    const items = await chrome.runtime.sendMessage({ type: 'GET_PLAYLIST_ITEMS', playlistId })
    const metaEl = document.getElementById('fl-modal-meta')
    const epsEl = document.getElementById('fl-modal-episodes')

    if (items?.error || !items?.length) {
      metaEl.textContent = '0 moments'
      epsEl.innerHTML = `<div class="fl-modal-empty">${items?.error || 'No moments saved yet. Go to a Netflix video and use the save button!'}</div>`
      return
    }

    metaEl.textContent = `${items.length} moment${items.length !== 1 ? 's' : ''}`

    epsEl.innerHTML = ''
    items.forEach((item, i) => {
      const hue = strHue(item.title + i)
      const watchUrl = item.netflix_url || (item.netflix_id ? `https://www.netflix.com/watch/${item.netflix_id}` : null)
      const epTag = item.season ? `S${item.season}:E${item.episode || '?'}` : ''

      const row = document.createElement('div')
      row.className = 'fl-ep'
      row.innerHTML = `
        <div class="fl-ep-index">${i + 1}</div>
        <div class="fl-ep-thumb" style="background: linear-gradient(135deg, hsl(${hue},25%,22%), hsl(${(hue + 60) % 360},20%,14%));">
          ${watchUrl ? '<div class="fl-ep-play-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M5 2.7a1 1 0 0 1 1.48-.88l16.93 9.3a1 1 0 0 1 0 1.76l-16.93 9.3A1 1 0 0 1 5 21.31z"/></svg></div>' : ''}
        </div>
        <div class="fl-ep-meta">
          <div class="fl-ep-title-row">
            <span class="fl-ep-title">${esc(item.title)}</span>
            ${epTag ? `<span class="fl-ep-duration">${epTag}</span>` : ''}
          </div>
          <p class="fl-ep-synopsis">${item.note ? esc(item.note) : ''}</p>
        </div>
      `

      if (watchUrl) {
        row.style.cursor = 'pointer'
        row.addEventListener('click', () => { closeDetailModal(); window.location.href = watchUrl })
      }

      // Rename on double-click
      const titleEl = row.querySelector('.fl-ep-title')
      titleEl.addEventListener('dblclick', e => {
        e.stopPropagation()
        const old = item.title
        titleEl.innerHTML = `<input class="fl-ep-rename" value="${esc(old)}" />`
        const inp = titleEl.querySelector('input')
        inp.focus(); inp.select()
        inp.addEventListener('click', ev => ev.stopPropagation())
        const save = async () => {
          const nv = inp.value.trim()
          if (nv && nv !== old) { await chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', itemId: item.id, updates: { title: nv } }); item.title = nv }
          titleEl.textContent = item.title
        }
        inp.addEventListener('blur', save)
        inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = old; inp.blur() } })
        inp.addEventListener('keyup', ev => ev.stopPropagation())
      })

      epsEl.appendChild(row)
    })
  }

  function modalEscHandler(e) { if (e.key === 'Escape') closeDetailModal() }

  function closeDetailModal() {
    document.getElementById('fl-modal-backdrop')?.remove()
    document.body.style.overflow = ''
    document.removeEventListener('keydown', modalEscHandler)
  }

  // ════════════════════════════════════════════════
  //  WATCH PAGE — save button near controls
  // ════════════════════════════════════════════════

  function removeWatch() {
    document.getElementById('fl-watch-root')?.remove()
    watchInjected = false
    stopKeepAlive()
  }

  async function injectWatch() {
    if (watchInjected && document.getElementById('fl-watch-root')) return
    const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
    if (!user) return

    removeWatch()
    watchInjected = true

    const root = document.createElement('div')
    root.id = 'fl-watch-root'
    root.innerHTML = `
      <button class="fl-watch-btn" id="fl-watch-btn">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M11 11V2h2v9h9v2h-9v9h-2v-9H2v-2z" clip-rule="evenodd"/></svg>
        FlixList
      </button>
      <div class="fl-watch-dropdown fl-hidden" id="fl-watch-dropdown">
        <div class="fl-watch-now" id="fl-watch-now"></div>
        <div class="fl-watch-list" id="fl-watch-list">
          <div class="fl-watch-loading">Loading…</div>
        </div>
        <div class="fl-watch-create-row">
          <input class="fl-watch-input" id="fl-watch-input" placeholder="New playlist…" />
          <button class="fl-watch-create" id="fl-watch-create">+</button>
        </div>
        <div class="fl-watch-status" id="fl-watch-status"></div>
      </div>
    `

    root.addEventListener('keydown', e => e.stopPropagation(), true)
    root.addEventListener('keyup', e => e.stopPropagation(), true)
    root.addEventListener('keypress', e => e.stopPropagation(), true)

    document.body.appendChild(root)

    const btn = document.getElementById('fl-watch-btn')
    const dd = document.getElementById('fl-watch-dropdown')
    let open = false

    btn.addEventListener('click', async e => {
      e.stopPropagation()
      open = !open
      dd.classList.toggle('fl-hidden', !open)
      if (open) { startKeepAlive(); await loadWatchPlaylists() } else { stopKeepAlive() }
    })
    document.addEventListener('click', e => { if (open && !root.contains(e.target)) { open = false; dd.classList.add('fl-hidden'); stopKeepAlive() } })

    // Create playlist
    const ci = document.getElementById('fl-watch-input')
    const cb = document.getElementById('fl-watch-create')
    cb.addEventListener('click', async () => {
      const t = ci.value.trim(); if (!t) return; cb.textContent = '…'
      try { await chrome.runtime.sendMessage({ type: 'CREATE_PLAYLIST', title: t }); ci.value = ''; await loadWatchPlaylists() } catch {}
      cb.textContent = '+'
    })
    ci.addEventListener('keydown', e => { if (e.key === 'Enter') cb.click() })
  }

  async function loadWatchPlaylists() {
    const list = document.getElementById('fl-watch-list')
    const now = document.getElementById('fl-watch-now')
    if (!list || !now) return

    const info = getNetflixInfo()
    now.textContent = info.title + (info.season ? ` · S${info.season}E${info.episode}` : '')

    list.innerHTML = '<div class="fl-watch-loading">Loading…</div>'
    const playlists = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' })

    if (playlists?.error) { list.innerHTML = `<div class="fl-watch-empty">${esc(playlists.error)}</div>`; return }
    if (!playlists?.length) { list.innerHTML = '<div class="fl-watch-empty">No playlists. Create one below.</div>'; return }

    list.innerHTML = ''
    playlists.forEach(p => {
      const item = document.createElement('button')
      item.className = 'fl-watch-item'
      item.textContent = p.title
      item.addEventListener('click', async () => {
        item.textContent = 'Saving…'; item.disabled = true
        const st = document.getElementById('fl-watch-status')
        try {
          const r = await chrome.runtime.sendMessage({
            type: 'ADD_TO_PLAYLIST', playlistId: p.id,
            item: { netflix_id: info.netflixId, netflix_url: info.netflixUrl, title: info.title, season: info.season, episode: info.episode }
          })
          if (r?.error) { st.textContent = r.error; st.className = 'fl-watch-status fl-status-err' }
          else { st.textContent = `✓ Saved to "${p.title}"`; st.className = 'fl-watch-status fl-status-ok' }
        } catch { st.textContent = 'Error'; st.className = 'fl-watch-status fl-status-err' }
        item.textContent = p.title; item.disabled = false
        setTimeout(() => { const s = document.getElementById('fl-watch-status'); if (s) s.textContent = '' }, 3000)
      })
      list.appendChild(item)
    })
  }
})()
