// FlixList — Content Script v3
;(function () {
  let currentUrl = '', rowInjected = false, watchInjected = false, keepAlive = null

  setInterval(() => { if (window.location.href !== currentUrl) { currentUrl = window.location.href; onNavigate() } }, 800)
  currentUrl = window.location.href
  setTimeout(onNavigate, 1000)

  function isBrowse() { return /netflix\.com\/(browse|latest|my-list|search)/.test(window.location.href) || window.location.pathname === '/' }
  function isWatch() { return /netflix\.com\/watch\//.test(window.location.href) }
  function onNavigate() { if (isBrowse()) { injectRow(); removeWatch() } else if (isWatch()) { injectWatch(); removeRow() } else { removeRow(); removeWatch() } }
  function startKeepAlive() { stopKeepAlive(); keepAlive = setInterval(() => document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true })), 2000) }
  function stopKeepAlive() { if (keepAlive) { clearInterval(keepAlive); keepAlive = null } }
  function strHue(s) { let h = 0; for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h); return ((h % 360) + 360) % 360 }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML }

  function getNetflixInfo() {
    const url = window.location.href, m = url.match(/watch\/(\d+)/), nid = m ? m[1] : null
    let title = ''
    for (const sel of ['[data-uia="video-title"]','[data-uia="player-title"]','.ellipsize-text']) { const el = document.querySelector(sel); if (el?.textContent?.trim()) { title = el.textContent.trim(); break } }
    let season = null, episode = null
    const ep = document.title.match(/S(\d+)[:\s]*E(\d+)/i) || document.title.match(/Season\s*(\d+).*Episode\s*(\d+)/i)
    if (ep) { season = parseInt(ep[1]); episode = parseInt(ep[2]) }
    if (!title) title = document.title.replace(/\s*\|?\s*Netflix\s*$/i, '').replace(/^\s*Watch\s*/i, '').trim() || `Netflix ${nid || 'moment'}`
    return { netflixId: nid, netflixUrl: url, title, season, episode }
  }

  // ════════════════════════════════════════════════
  //  BROWSE ROW — carousel with arrow navigation
  // ════════════════════════════════════════════════

  function removeRow() { document.getElementById('fl-row')?.remove(); rowInjected = false }

  async function injectRow() {
    if (rowInjected && document.getElementById('fl-row')) return
    const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
    if (!user) { removeRow(); return }
    removeRow(); rowInjected = true

    const row = document.createElement('div')
    row.id = 'fl-row'
    row.innerHTML = `
      <h2 class="fl-row-title">My FlixList Playlists</h2>
      <div class="fl-row-viewport">
        <button class="fl-row-arrow fl-row-arrow-left fl-hidden" id="fl-arrow-l" aria-label="Scroll left">‹</button>
        <div class="fl-row-slider" id="fl-row-slider"><div class="fl-row-loading">Loading playlists…</div></div>
        <button class="fl-row-arrow fl-row-arrow-right" id="fl-arrow-r" aria-label="Scroll right">›</button>
      </div>
      <div class="fl-row-create"><input class="fl-row-input" id="fl-row-input" placeholder="New playlist name…" /><button class="fl-row-create-btn" id="fl-row-create-btn">+ Create</button></div>
    `
    row.addEventListener('keydown', e => e.stopPropagation(), true)
    row.addEventListener('keyup', e => e.stopPropagation(), true)

    const insertInto = () => {
      const parent = document.querySelector('.lolomoRow')?.parentElement || document.querySelector('[class*="lolomo"]') || document.querySelector('main') || document.querySelector('.mainView')
      if (parent && !document.getElementById('fl-row')) {
        const rows = parent.querySelectorAll(':scope > div')
        if (rows.length > 1) rows[1].after(row); else parent.prepend(row)
        loadRowPlaylists()
        wireRowCreate()
        wireArrows()
      }
    }
    insertInto()
    if (!document.getElementById('fl-row')) { let t = 0; const iv = setInterval(() => { t++; insertInto(); if (document.getElementById('fl-row') || t > 15) clearInterval(iv) }, 1000) }
  }

  function wireArrows() {
    const slider = document.getElementById('fl-row-slider')
    const left = document.getElementById('fl-arrow-l')
    const right = document.getElementById('fl-arrow-r')
    if (!slider || !left || !right) return

    const scrollAmt = () => slider.clientWidth * 0.8

    right.addEventListener('click', () => { slider.scrollBy({ left: scrollAmt(), behavior: 'smooth' }) })
    left.addEventListener('click', () => { slider.scrollBy({ left: -scrollAmt(), behavior: 'smooth' }) })

    slider.addEventListener('scroll', () => {
      left.classList.toggle('fl-hidden', slider.scrollLeft < 10)
      right.classList.toggle('fl-hidden', slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 10)
    })
  }

  async function loadRowPlaylists() {
    const slider = document.getElementById('fl-row-slider')
    if (!slider) return
    const playlists = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' })
    if (playlists?.error) { slider.innerHTML = `<div class="fl-row-empty">${esc(playlists.error)}</div>`; return }
    if (!playlists?.length) { slider.innerHTML = '<div class="fl-row-empty">No playlists yet. Create one below.</div>'; return }

    slider.innerHTML = ''
    playlists.forEach(p => {
      const count = p.playlist_items?.[0]?.count ?? 0
      const hue = strHue(p.title)
      const card = document.createElement('div')
      card.className = 'fl-title-card'
      card.tabIndex = 0; card.role = 'button'; card.ariaLabel = p.title
      card.innerHTML = `
        <div class="fl-title-card-image" style="background:linear-gradient(135deg,hsl(${hue},28%,18%),hsl(${(hue+50)%360},22%,10%));">
          <div class="fl-title-card-overlay"><svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M5 2.7a1 1 0 0 1 1.48-.88l16.93 9.3a1 1 0 0 1 0 1.76l-16.93 9.3A1 1 0 0 1 5 21.31z"/></svg></div>
          <div class="fl-title-card-badge">${count}</div>
        </div>
        <p class="fl-title-card-name">${esc(p.title)}</p>
      `
      card.addEventListener('click', () => openDetailModal(p))
      slider.appendChild(card)
    })

    // Update arrow visibility
    const right = document.getElementById('fl-arrow-r')
    if (right) right.classList.toggle('fl-hidden', slider.scrollWidth <= slider.clientWidth)
  }

  function wireRowCreate() {
    const inp = document.getElementById('fl-row-input'), btn = document.getElementById('fl-row-create-btn')
    if (!inp || !btn) return
    btn.addEventListener('click', async () => { const t = inp.value.trim(); if (!t) return; btn.textContent = '…'; btn.disabled = true; try { await chrome.runtime.sendMessage({ type: 'CREATE_PLAYLIST', title: t }); inp.value = ''; await loadRowPlaylists() } catch {} btn.textContent = '+ Create'; btn.disabled = false })
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click() })
  }

  // ════════════════════════════════════════════════
  //  DETAIL MODAL — edit title, delete, author, reorder
  // ════════════════════════════════════════════════

  async function openDetailModal(playlist) {
    closeDetailModal()
    const hue = strHue(playlist.title)
    const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
    const isOwner = user && playlist.user_id === user.id

    const backdrop = document.createElement('div')
    backdrop.id = 'fl-modal-backdrop'
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeDetailModal() })

    const modal = document.createElement('div')
    modal.id = 'fl-modal'
    modal.innerHTML = `
      <div class="fl-modal-hero" style="background:linear-gradient(135deg,hsl(${hue},30%,15%),hsl(${(hue+50)%360},20%,8%));">
        <div class="fl-modal-hero-gradient"></div>
        <div class="fl-modal-hero-content">
          <div class="fl-modal-logo" id="fl-modal-title">${esc(playlist.title)}</div>
          <div class="fl-modal-hero-meta" id="fl-modal-meta"></div>
          ${isOwner ? `<div class="fl-modal-actions">
            <button class="fl-modal-action-btn" id="fl-modal-edit" title="Edit title">✎ Edit</button>
            <button class="fl-modal-action-btn fl-modal-action-danger" id="fl-modal-delete" title="Delete playlist">✕ Delete</button>
          </div>` : ''}
        </div>
        <button class="fl-modal-close" id="fl-modal-close"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path fill-rule="evenodd" d="M10.586 12 2.293 3.707l1.414-1.414L12 10.586l8.293-8.293 1.414 1.414L13.414 12l8.293 8.293-1.414 1.414L12 13.414l-8.293 8.293-1.414-1.414z" clip-rule="evenodd"/></svg></button>
      </div>
      <div class="fl-modal-body">
        <div class="fl-modal-section-head">Episodes</div>
        <div id="fl-modal-episodes" class="fl-modal-episodes"><div class="fl-modal-loading">Loading…</div></div>
      </div>
    `
    modal.addEventListener('keydown', e => e.stopPropagation(), true)
    modal.addEventListener('keyup', e => e.stopPropagation(), true)

    backdrop.appendChild(modal)
    document.body.appendChild(backdrop)
    document.body.style.overflow = 'hidden'

    document.getElementById('fl-modal-close').addEventListener('click', closeDetailModal)
    document.addEventListener('keydown', modalEscHandler)

    // Edit title
    if (isOwner) {
      document.getElementById('fl-modal-edit')?.addEventListener('click', () => {
        const titleEl = document.getElementById('fl-modal-title')
        const old = playlist.title
        titleEl.innerHTML = `<input class="fl-modal-rename-input" value="${esc(old)}" />`
        const inp = titleEl.querySelector('input')
        inp.focus(); inp.select()
        inp.addEventListener('click', ev => ev.stopPropagation())
        const save = async () => {
          const nv = inp.value.trim()
          if (nv && nv !== old) { await chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', itemId: playlist.id, updates: { title: nv } }).catch(() => {}); playlist.title = nv }
          titleEl.textContent = playlist.title
          loadRowPlaylists()
        }
        inp.addEventListener('blur', save)
        inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = old; inp.blur() } })
        inp.addEventListener('keyup', ev => ev.stopPropagation())
      })

      document.getElementById('fl-modal-delete')?.addEventListener('click', async () => {
        if (!confirm(`Delete "${playlist.title}" permanently?`)) return
        try {
          // Delete via REST
          const token = await new Promise(r => chrome.runtime.sendMessage({ type: 'GET_USER' }, () => chrome.storage.local.get('flixlist_token', d => r(d.flixlist_token))))
          // Use background to delete
          await chrome.runtime.sendMessage({ type: 'REMOVE_ITEM', itemId: playlist.id }) // reuse endpoint pattern
        } catch {}
        closeDetailModal()
        loadRowPlaylists()
      })
    }

    // Load items
    const items = await chrome.runtime.sendMessage({ type: 'GET_PLAYLIST_ITEMS', playlistId: playlist.id })
    const metaEl = document.getElementById('fl-modal-meta')
    const epsEl = document.getElementById('fl-modal-episodes')

    const authorName = playlist.profiles?.username || user?.user_metadata?.username || ''
    metaEl.innerHTML = `${items?.length || 0} moment${(items?.length || 0) !== 1 ? 's' : ''}${authorName ? ` · <span class="fl-modal-author">by ${esc(authorName)}</span>` : ''}`

    if (items?.error || !items?.length) {
      epsEl.innerHTML = `<div class="fl-modal-empty">${items?.error || 'No moments saved yet.'}</div>`
      return
    }

    renderModalEpisodes(epsEl, items, isOwner, playlist.id)
  }

  function renderModalEpisodes(container, items, isOwner, playlistId) {
    container.innerHTML = ''
    let dragSrcIndex = null

    items.forEach((item, i) => {
      const hue = strHue(item.title + i)
      const watchUrl = item.netflix_url || (item.netflix_id ? `https://www.netflix.com/watch/${item.netflix_id}` : null)
      const epTag = item.season ? `S${item.season}:E${item.episode || '?'}` : ''

      const row = document.createElement('div')
      row.className = 'fl-ep'
      if (isOwner) { row.draggable = true; row.dataset.index = i }

      row.innerHTML = `
        <div class="fl-ep-index">${i + 1}</div>
        ${isOwner ? '<div class="fl-ep-grip" title="Drag to reorder">⠿</div>' : ''}
        <div class="fl-ep-thumb" style="background:linear-gradient(135deg,hsl(${hue},25%,22%),hsl(${(hue+60)%360},20%,14%));">
          ${watchUrl ? '<div class="fl-ep-play-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M5 2.7a1 1 0 0 1 1.48-.88l16.93 9.3a1 1 0 0 1 0 1.76l-16.93 9.3A1 1 0 0 1 5 21.31z"/></svg></div>' : ''}
        </div>
        <div class="fl-ep-meta">
          <div class="fl-ep-title-row">
            <span class="fl-ep-title">${esc(item.title)}</span>
            ${epTag ? `<span class="fl-ep-duration">${epTag}</span>` : ''}
          </div>
          ${item.note ? `<p class="fl-ep-synopsis">${esc(item.note)}</p>` : ''}
        </div>
        ${isOwner ? `<button class="fl-ep-remove" title="Remove from playlist">−</button>` : ''}
      `

      // Click to watch
      const thumb = row.querySelector('.fl-ep-thumb')
      if (watchUrl && thumb) { thumb.style.cursor = 'pointer'; thumb.addEventListener('click', e => { e.stopPropagation(); closeDetailModal(); window.location.href = watchUrl }) }

      // Rename on double-click
      const titleEl = row.querySelector('.fl-ep-title')
      titleEl.addEventListener('dblclick', e => {
        e.stopPropagation()
        const old = item.title
        titleEl.innerHTML = `<input class="fl-ep-rename" value="${esc(old)}" />`
        const inp = titleEl.querySelector('input')
        inp.focus(); inp.select()
        inp.addEventListener('click', ev => ev.stopPropagation())
        const save = async () => { const nv = inp.value.trim(); if (nv && nv !== old) { await chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', itemId: item.id, updates: { title: nv } }); item.title = nv }; titleEl.textContent = item.title }
        inp.addEventListener('blur', save)
        inp.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = old; inp.blur() } })
        inp.addEventListener('keyup', ev => ev.stopPropagation())
      })

      // Remove item
      if (isOwner) {
        row.querySelector('.fl-ep-remove')?.addEventListener('click', async e => {
          e.stopPropagation()
          await chrome.runtime.sendMessage({ type: 'REMOVE_ITEM', itemId: item.id })
          items.splice(i, 1)
          renderModalEpisodes(container, items, isOwner, playlistId)
          loadRowPlaylists()
        })
      }

      // Drag and drop reorder
      if (isOwner) {
        row.addEventListener('dragstart', e => { dragSrcIndex = i; row.classList.add('fl-ep-dragging'); e.dataTransfer.effectAllowed = 'move' })
        row.addEventListener('dragend', () => { row.classList.remove('fl-ep-dragging'); document.querySelectorAll('.fl-ep-dragover').forEach(el => el.classList.remove('fl-ep-dragover')) })
        row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('fl-ep-dragover') })
        row.addEventListener('dragleave', () => row.classList.remove('fl-ep-dragover'))
        row.addEventListener('drop', async e => {
          e.preventDefault(); row.classList.remove('fl-ep-dragover')
          const toIndex = i
          if (dragSrcIndex === null || dragSrcIndex === toIndex) return
          const [moved] = items.splice(dragSrcIndex, 1)
          items.splice(toIndex, 0, moved)
          renderModalEpisodes(container, items, isOwner, playlistId)
          // Persist order
          for (let j = 0; j < items.length; j++) {
            await chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', itemId: items[j].id, updates: { position: j } })
          }
        })
      }

      container.appendChild(row)
    })
  }

  function modalEscHandler(e) { if (e.key === 'Escape') closeDetailModal() }
  function closeDetailModal() { document.getElementById('fl-modal-backdrop')?.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', modalEscHandler) }

  // ════════════════════════════════════════════════
  //  WATCH PAGE — Spotify-like playlist browser
  // ════════════════════════════════════════════════

  function removeWatch() { document.getElementById('fl-watch-root')?.remove(); watchInjected = false; stopKeepAlive() }

  async function injectWatch() {
    if (watchInjected && document.getElementById('fl-watch-root')) return
    const user = await chrome.runtime.sendMessage({ type: 'GET_USER' })
    if (!user) return
    removeWatch(); watchInjected = true

    const root = document.createElement('div')
    root.id = 'fl-watch-root'
    root.innerHTML = `
      <button class="fl-watch-btn" id="fl-watch-btn">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path fill-rule="evenodd" d="M11 11V2h2v9h9v2h-9v9h-2v-9H2v-2z" clip-rule="evenodd"/></svg>
        FlixList
      </button>
      <div class="fl-watch-dd fl-hidden" id="fl-watch-dd">
        <div class="fl-watch-header" id="fl-watch-header">
          <span class="fl-watch-header-title">My Playlists</span>
        </div>
        <div class="fl-watch-content" id="fl-watch-content"></div>
        <div class="fl-watch-status" id="fl-watch-status"></div>
      </div>
    `
    root.addEventListener('keydown', e => e.stopPropagation(), true)
    root.addEventListener('keyup', e => e.stopPropagation(), true)
    root.addEventListener('keypress', e => e.stopPropagation(), true)
    document.body.appendChild(root)

    const btn = document.getElementById('fl-watch-btn')
    const dd = document.getElementById('fl-watch-dd')
    let open = false

    btn.addEventListener('click', e => { e.stopPropagation(); open = !open; dd.classList.toggle('fl-hidden', !open); if (open) { startKeepAlive(); showWatchPlaylists() } else stopKeepAlive() })
    document.addEventListener('click', e => { if (open && !root.contains(e.target)) { open = false; dd.classList.add('fl-hidden'); stopKeepAlive() } })
  }

  // ─── Watch dropdown: playlists view ─────────────
  async function showWatchPlaylists() {
    const header = document.getElementById('fl-watch-header')
    const content = document.getElementById('fl-watch-content')
    header.innerHTML = '<span class="fl-watch-header-title">My Playlists</span>'
    content.innerHTML = '<div class="fl-watch-loading">Loading…</div>'

    const playlists = await chrome.runtime.sendMessage({ type: 'GET_PLAYLISTS' })
    if (playlists?.error) { content.innerHTML = `<div class="fl-watch-empty">${esc(playlists.error)}</div>`; return }

    content.innerHTML = ''

    // Create row at top
    const createRow = document.createElement('div')
    createRow.className = 'fl-watch-create-row'
    createRow.innerHTML = `<input class="fl-watch-input" placeholder="New playlist…" /><button class="fl-watch-create-sm">+</button>`
    const ci = createRow.querySelector('input'), cb = createRow.querySelector('button')
    cb.addEventListener('click', async () => { const t = ci.value.trim(); if (!t) return; cb.textContent = '…'; try { await chrome.runtime.sendMessage({ type: 'CREATE_PLAYLIST', title: t }); ci.value = ''; showWatchPlaylists() } catch {} cb.textContent = '+' })
    ci.addEventListener('keydown', e => { if (e.key === 'Enter') cb.click() })
    content.appendChild(createRow)

    if (!playlists?.length) { content.insertAdjacentHTML('beforeend', '<div class="fl-watch-empty">No playlists yet.</div>'); return }

    playlists.forEach(p => {
      const count = p.playlist_items?.[0]?.count ?? 0
      const item = document.createElement('button')
      item.className = 'fl-watch-pl-item'
      item.innerHTML = `<span class="fl-watch-pl-name">${esc(p.title)}</span><span class="fl-watch-pl-count">${count}</span>`
      item.addEventListener('click', () => showWatchPlaylistDetail(p))
      content.appendChild(item)
    })
  }

  // ─── Watch dropdown: playlist detail view ───────
  async function showWatchPlaylistDetail(playlist) {
    const header = document.getElementById('fl-watch-header')
    const content = document.getElementById('fl-watch-content')
    const status = document.getElementById('fl-watch-status')
    if (status) status.textContent = ''

    header.innerHTML = `<button class="fl-watch-back" id="fl-watch-back">‹</button><span class="fl-watch-header-title">${esc(playlist.title)}</span>`
    document.getElementById('fl-watch-back').addEventListener('click', showWatchPlaylists)

    content.innerHTML = '<div class="fl-watch-loading">Loading…</div>'
    const items = await chrome.runtime.sendMessage({ type: 'GET_PLAYLIST_ITEMS', playlistId: playlist.id })

    content.innerHTML = ''

    // Add current video button
    const addBtn = document.createElement('button')
    addBtn.className = 'fl-watch-add-current'
    addBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path fill-rule="evenodd" d="M11 11V2h2v9h9v2h-9v9h-2v-9H2v-2z" clip-rule="evenodd"/></svg> Add current video`
    addBtn.addEventListener('click', async () => {
      const info = getNetflixInfo()
      addBtn.textContent = 'Saving…'; addBtn.disabled = true
      try {
        const r = await chrome.runtime.sendMessage({ type: 'ADD_TO_PLAYLIST', playlistId: playlist.id, item: { netflix_id: info.netflixId, netflix_url: info.netflixUrl, title: info.title, season: info.season, episode: info.episode } })
        if (r?.error) { if (status) { status.textContent = r.error; status.className = 'fl-watch-status fl-status-err' } }
        else { if (status) { status.textContent = '✓ Added'; status.className = 'fl-watch-status fl-status-ok' }; showWatchPlaylistDetail(playlist) }
      } catch { if (status) { status.textContent = 'Error'; status.className = 'fl-watch-status fl-status-err' } }
      addBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path fill-rule="evenodd" d="M11 11V2h2v9h9v2h-9v9h-2v-9H2v-2z" clip-rule="evenodd"/></svg> Add current video`; addBtn.disabled = false
      setTimeout(() => { if (status) status.textContent = '' }, 2500)
    })
    content.appendChild(addBtn)

    if (items?.error || !items?.length) {
      content.insertAdjacentHTML('beforeend', `<div class="fl-watch-empty">${items?.error || 'Empty playlist.'}</div>`)
      return
    }

    let dragSrc = null

    items.forEach((item, i) => {
      const watchUrl = item.netflix_url || (item.netflix_id ? `https://www.netflix.com/watch/${item.netflix_id}` : null)
      const epTag = item.season ? `S${item.season}E${item.episode || '?'}` : ''

      const row = document.createElement('div')
      row.className = 'fl-watch-ep'
      row.draggable = true
      row.dataset.index = i
      row.innerHTML = `
        <span class="fl-watch-ep-grip" title="Drag to reorder">⠿</span>
        <div class="fl-watch-ep-info">
          <span class="fl-watch-ep-name">${esc(item.title)}</span>
          ${epTag ? `<span class="fl-watch-ep-tag">${epTag}</span>` : ''}
        </div>
        ${watchUrl ? `<button class="fl-watch-ep-play" title="Watch">▶</button>` : ''}
        <button class="fl-watch-ep-del" title="Remove">−</button>
      `

      // Play
      row.querySelector('.fl-watch-ep-play')?.addEventListener('click', e => { e.stopPropagation(); window.location.href = watchUrl })

      // Delete
      row.querySelector('.fl-watch-ep-del').addEventListener('click', async e => {
        e.stopPropagation()
        await chrome.runtime.sendMessage({ type: 'REMOVE_ITEM', itemId: item.id })
        items.splice(i, 1)
        showWatchPlaylistDetail(playlist)
      })

      // Drag reorder
      row.addEventListener('dragstart', e => { dragSrc = i; row.classList.add('fl-watch-ep-dragging'); e.dataTransfer.effectAllowed = 'move' })
      row.addEventListener('dragend', () => { row.classList.remove('fl-watch-ep-dragging'); document.querySelectorAll('.fl-watch-ep-dragover').forEach(el => el.classList.remove('fl-watch-ep-dragover')) })
      row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.classList.add('fl-watch-ep-dragover') })
      row.addEventListener('dragleave', () => row.classList.remove('fl-watch-ep-dragover'))
      row.addEventListener('drop', async e => {
        e.preventDefault(); row.classList.remove('fl-watch-ep-dragover')
        if (dragSrc === null || dragSrc === i) return
        const [moved] = items.splice(dragSrc, 1)
        items.splice(i, 0, moved)
        showWatchPlaylistDetail(playlist)
        for (let j = 0; j < items.length; j++) await chrome.runtime.sendMessage({ type: 'UPDATE_ITEM', itemId: items[j].id, updates: { position: j } })
      })

      content.appendChild(row)
    })
  }
})()
