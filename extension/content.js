/**
 * FlixList Content Script
 * Injects playlists as a native Netflix row.
 * Opens playlists in a Netflix-style detail modal with episodes.
 */

(function () {
  'use strict';

  // ── Config ────────────────────────────────────────────────────────────────
  const SUPABASE_URL = 'YOUR_SUPABASE_URL';
  const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

  // ── State ─────────────────────────────────────────────────────────────────
  let lastUrl = location.href;
  let rowInjected = false;
  let activeModal = null;
  let urlCheckInterval = null;

  // ── Background messaging ──────────────────────────────────────────────────
  function bgMessage(type, payload = null) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type, payload }, (res) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(res);
        });
      } catch { resolve(null); }
    });
  }

  // ── Supabase helpers ──────────────────────────────────────────────────────
  async function supabaseFetch(path, options = {}) {
    const session = await bgMessage('GET_SESSION');
    const headers = {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': session?.access_token
        ? `Bearer ${session.access_token}`
        : `Bearer ${SUPABASE_ANON_KEY}`,
      ...options.headers,
    };
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...options, headers });
      if (!res.ok) return null;
      return res.json();
    } catch { return null; }
  }

  async function getMyPlaylists() {
    const session = await bgMessage('GET_SESSION');
    if (!session?.user?.id) return null; // null = not signed in
    const data = await supabaseFetch(
      `/playlists?user_id=eq.${session.user.id}&select=id,title,description,item_count,is_public&order=created_at.desc&limit=20`
    );
    return data || [];
  }

  async function getPlaylistFull(playlistId) {
    const data = await supabaseFetch(
      `/playlists?id=eq.${playlistId}&select=*,items:playlist_items(*)&limit=1`
    );
    if (!data?.[0]) return null;
    const pl = data[0];
    if (pl.items) pl.items.sort((a, b) => a.order_index - b.order_index);
    return pl;
  }

  // ── Row injection ─────────────────────────────────────────────────────────
  async function tryInjectRow() {
    if (rowInjected) return;

    // Wait for the Netflix row container to exist
    for (let i = 0; i < 8; i++) {
      const firstRow = document.querySelector('.lolomoRow');
      if (firstRow) {
        await injectRow(firstRow);
        return;
      }
      await sleep(1000);
    }
  }

  async function injectRow(firstRow) {
    const playlists = await getMyPlaylists();

    // Remove existing FlixList row if it exists
    document.getElementById('flixlist-injected-row')?.remove();

    const row = document.createElement('div');
    row.id = 'flixlist-injected-row';
    row.className = 'lolomoRow lolomoRow_title_card default-ltr-iqcdef-cache-0';
    row.setAttribute('data-list-context', 'genre');

    // Not signed in — show a sign-in prompt card
    if (playlists === null) {
      row.innerHTML = buildSignInRow();
    } else if (playlists.length === 0) {
      row.innerHTML = buildEmptyRow();
    } else {
      row.innerHTML = buildPlaylistRow(playlists);
    }

    firstRow.parentNode.insertBefore(row, firstRow);
    rowInjected = true;

    // Bind clicks on playlist cards
    row.querySelectorAll('[data-flixlist-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(el.dataset.flixlistId, el.dataset.flixlistTitle);
      });
    });
  }

  function buildPlaylistRow(playlists) {
    const cards = playlists.map((pl, i) => buildCard(pl, i)).join('');
    return `
      <h2 class="rowTitle default-ltr-iqcdef-cache-0 flixlist-row-heading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="flixlist-row-icon">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        My FlixList Playlists
      </h2>
      <div class="rowContainer rowContainer_title_card">
        <div class="ptrack-container">
          <div class="rowContent slider-hover-trigger-layer">
            <div class="slider">
              <div class="sliderMask showPeek">
                <div class="sliderContent row-with-x-columns">
                  ${cards}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildCard(pl, i) {
    // Pick the best poster — use a CSS background so it doesn't 404-flash
    const hasPoster = !!pl.poster_url;
    const bgStyle = hasPoster
      ? `style="background-image:url('${esc(pl.poster_url)}');background-size:cover;background-position:center;"`
      : `style="background:linear-gradient(135deg,#1a1031 0%,#0d1b2a 100%);"`;

    return `
      <div class="slider-item slider-item-${i}">
        <div class="title-card-container default-ltr-iqcdef-cache-0" data-uia="title-card-container">
          <div id="flixlist-card-${pl.id}" class="title-card flixlist-card">
            <div class="ptrack-content">
              <a href="#"
                 class="slider-refocus flixlist-card-anchor"
                 role="link"
                 aria-label="${esc(pl.title)}"
                 tabindex="0"
                 data-flixlist-id="${esc(pl.id)}"
                 data-flixlist-title="${esc(pl.title)}">
                <div class="boxart-container boxart-rounded boxart-size-16x9">
                  <!-- Background image layer -->
                  <div class="flixlist-card-bg" ${bgStyle}></div>
                  <!-- Overlay with name + count -->
                  <div class="flixlist-card-overlay">
                    <div class="flixlist-card-body">
                      <p class="flixlist-card-name">${escHtml(pl.title)}</p>
                      <p class="flixlist-card-meta">${pl.item_count || 0} item${pl.item_count !== 1 ? 's' : ''}</p>
                    </div>
                    <div class="flixlist-card-play">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                    </div>
                  </div>
                  <div class="fallback-text-container" aria-hidden="true">
                    <p class="fallback-text">${escHtml(pl.title)}</p>
                  </div>
                </div>
              </a>
            </div>
            <div class="bob-container"></div>
          </div>
        </div>
      </div>
    `;
  }

  function buildSignInRow() {
    return `
      <h2 class="rowTitle default-ltr-iqcdef-cache-0 flixlist-row-heading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="flixlist-row-icon">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        FlixList Playlists
      </h2>
      <div class="rowContainer rowContainer_title_card">
        <div class="ptrack-container">
          <div class="rowContent slider-hover-trigger-layer">
            <div class="slider">
              <div class="sliderMask showPeek">
                <div class="sliderContent row-with-x-columns">
                  <div class="slider-item slider-item-0">
                    <div class="flixlist-signin-card">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e5a00d" stroke-width="2">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                      </svg>
                      <p>Sign in to FlixList<br>to see your playlists here</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function buildEmptyRow() {
    return `
      <h2 class="rowTitle default-ltr-iqcdef-cache-0 flixlist-row-heading">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="flixlist-row-icon">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        My FlixList Playlists
      </h2>
      <div class="rowContainer rowContainer_title_card">
        <div class="ptrack-container">
          <div class="rowContent slider-hover-trigger-layer">
            <div class="slider">
              <div class="sliderMask showPeek">
                <div class="sliderContent row-with-x-columns">
                  <div class="slider-item slider-item-0">
                    <div class="flixlist-signin-card">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e5a00d" stroke-width="2">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                      <p>No playlists yet.<br>Click the extension to create one.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  async function openModal(playlistId, title) {
    closeModal();
    document.body.style.overflow = 'hidden';

    // Create shell with loading state
    const overlay = document.createElement('div');
    overlay.id = 'flixlist-modal-overlay';
    overlay.innerHTML = buildLoadingShell(title);
    document.body.appendChild(overlay);
    activeModal = overlay;

    // Backdrop click closes
    overlay.querySelector('#flixlist-backdrop')?.addEventListener('click', closeModal);
    // ESC key
    const onEsc = (e) => { if (e.key === 'Escape') closeModal(); };
    document.addEventListener('keydown', onEsc);
    overlay._onEsc = onEsc;

    // Fetch full data
    const playlist = await getPlaylistFull(playlistId);
    if (!playlist || !activeModal) return;

    // Re-render with real content
    overlay.innerHTML = buildModalShell(playlist);
    bindModalClicks(overlay, playlist);
  }

  function buildLoadingShell(title) {
    return `
      <div id="flixlist-backdrop" class="flixlist-backdrop"></div>
      <div class="focus-trap-wrapper previewModal--wrapper detail-modal flixlist-modal-positioner">
        <div class="previewModal--container has-smaller-buttons detail-modal flixlist-modal-box" role="dialog" aria-modal="true">
          <div class="flixlist-loading-state">
            <div class="flixlist-spinner"></div>
            <p>Loading ${escHtml(title)}…</p>
          </div>
        </div>
      </div>
    `;
  }

  function buildModalShell(playlist) {
    const items = playlist.items || [];

    // Header: use first item's poster, or dark gradient fallback
    const headerPoster = items.find(i => i.poster_url)?.poster_url || '';
    const headerBg = headerPoster
      ? `background-image:url('${esc(headerPoster)}');background-size:cover;background-position:center top;`
      : 'background:linear-gradient(180deg,#1a1031 0%,#0d1b2a 100%);';

    const episodesHTML = items.length
      ? items.map((item, i) => buildEpisodeItem(item, i + 1)).join('')
      : `<div class="flixlist-no-items">
           <p>This playlist is empty. Browse Netflix and save shows with the FlixList extension button.</p>
         </div>`;

    return `
      <!-- Backdrop -->
      <div id="flixlist-backdrop" class="flixlist-backdrop"></div>

      <!-- Modal — mirrors Netflix's .previewModal--wrapper.detail-modal -->
      <div class="focus-trap-wrapper previewModal--wrapper detail-modal flixlist-modal-positioner">
        <div class="previewModal--container has-smaller-buttons detail-modal flixlist-modal-box"
             role="dialog" aria-modal="true" tabindex="-1">

          <!-- ── Header / "player" area ── -->
          <div class="previewModal--player_container has-smaller-buttons detail-modal previewModal--player-not-playable flixlist-modal-hero"
               style="${headerBg}">

            <!-- gradient fade to modal body -->
            <div class="flixlist-hero-fade"></div>

            <!-- Title treatment (bottom-left of hero) -->
            <div class="previewModal--player-titleTreatmentWrapper" style="pointer-events:auto;opacity:1;">
              <div class="previewModal--player-titleTreatment previewModal--player-titleTreatment-left has-smaller-buttons detail-modal">

                <div class="flixlist-hero-meta">
                  <span class="flixlist-badge">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    FlixList Playlist
                  </span>
                </div>

                <h1 class="flixlist-hero-title">${escHtml(playlist.title)}</h1>

                ${playlist.description
                  ? `<p class="flixlist-hero-desc">${escHtml(playlist.description)}</p>`
                  : ''}

                <div class="buttonControls--container flixlist-hero-controls" data-uia="mini-modal-controls">
                  <span class="flixlist-hero-stat">${items.length} episode${items.length !== 1 ? 's' : ''}</span>
                  ${playlist.is_public
                    ? '<span class="flixlist-hero-stat flixlist-stat-public">🌐 Public</span>'
                    : '<span class="flixlist-hero-stat">🔒 Private</span>'}
                </div>

              </div>
            </div>

            <!-- Mute button area (placeholder to match Netflix layout) -->
            <div class="previewModal-audioToggle has-smaller-buttons detail-modal" style="display:none;"></div>
          </div>

          <!-- ── Close button ── -->
          <div class="previewModal-close flixlist-close-btn" id="flixlist-close-btn">
            <span data-uia="previewModal-closebtn" role="button" aria-label="close" tabindex="0">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill="currentColor" fill-rule="evenodd"
                      d="M10.586 12 2.293 3.707l1.414-1.414L12 10.586l8.293-8.293 1.414 1.414L13.414 12l8.293 8.293-1.414 1.414L12 13.414l-8.293 8.293-1.414-1.414z"
                      clip-rule="evenodd"></path>
              </svg>
            </span>
          </div>

          <!-- ── Info section ── -->
          <div class="previewModal--info" style="opacity:1;transform:none;">
            <div class="detail-modal-container">
              <div class="ptrack-container">
                <div>
                  <!-- Episode description of first item mirrors Netflix's synopsis area -->
                  <div class="previewModal--detailsMetadata detail-modal has-smaller-buttons">
                    <div class="previewModal--detailsMetadata-left">
                      <div class="previewModal--detailsMetadata-info">
                        <div class="videoMetadata--container">
                          <div class="videoMetadata--line">
                            <span class="duration">${items.length} item${items.length !== 1 ? 's' : ''}</span>
                            ${playlist.is_public
                              ? '<span class="player-feature-badge">PUBLIC</span>'
                              : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ── Episodes list ── -->
              <div class="ptrack-container">
                <div class="ptrack-content">
                  <div class="episodeSelector" data-uia="episode-selector">
                    <div class="episodeSelector-header">
                      <div>
                        <h3 class="previewModal--section-header episodeSelector-label show-single-season">
                          Episodes
                        </h3>
                      </div>
                    </div>

                    <div class="episodeSelector-container">
                      <!-- Season label mimicking Netflix -->
                      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span class="allEpisodeSelector-season-label default-ltr-iqcdef-cache-1x63fpa">
                          ${escHtml(playlist.title)}:
                        </span>
                      </div>

                      ${episodesHTML}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    `;
  }

  function buildEpisodeItem(item, num) {
    const watchUrl = item.netflix_url || `https://www.netflix.com/watch/${item.netflix_id}`;

    // Episode label: "S1:E3 Title" → bold the S1E3 part
    let episodeLabelHTML = '';
    if (item.episode_label) {
      const seMatch = item.episode_label.match(/^([Ss]\d+[:\s][Ee]\d+)\s*(.*)/);
      if (seMatch) {
        episodeLabelHTML = `<b>${escHtml(seMatch[1])}</b> "${escHtml(seMatch[2] || item.episode_title || '')}"`;
      } else {
        episodeLabelHTML = escHtml(item.episode_label);
      }
    }

    const posterEl = item.poster_url
      ? `<img src="${esc(item.poster_url)}" alt="${esc(item.series_title)}">`
      : `<div class="flixlist-ep-poster-placeholder">🎬</div>`;

    return `
      <div class="titleCardList--container episode-item flixlist-episode-row"
           tabindex="0"
           aria-label="${esc(item.series_title)}"
           data-watch-url="${esc(watchUrl)}"
           data-uia="titleCard--container"
           role="button">

        <div class="titleCard-title_index">${num}</div>

        <div class="titleCard-imageWrapper">
          <div class="ptrack-content">
            ${posterEl}
          </div>
          <div class="titleCard-playIcon">
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fill="currentColor"
                    d="M5 2.7a1 1 0 0 1 1.48-.88l16.93 9.3a1 1 0 0 1 0 1.76l-16.93 9.3A1 1 0 0 1 5 21.31z">
              </path>
            </svg>
          </div>
        </div>

        <div class="titleCardList--metadataWrapper">
          <div class="titleCardList-title">
            <span class="titleCard-title_text">${escHtml(item.series_title)}</span>
          </div>
          <p class="titleCard-synopsis previewModal--small-text">
            <div class="ptrack-content">
              ${episodeLabelHTML || '&nbsp;'}
              ${item.note ? `<span class="flixlist-ep-note">${escHtml(item.note)}</span>` : ''}
            </div>
          </p>
        </div>
      </div>
    `;
  }

  function bindModalClicks(overlay, playlist) {
    // Close button
    overlay.querySelector('#flixlist-close-btn')?.addEventListener('click', closeModal);
    overlay.querySelector('#flixlist-backdrop')?.addEventListener('click', closeModal);

    // Episode rows → navigate to Netflix watch URL
    overlay.querySelectorAll('.flixlist-episode-row').forEach(row => {
      row.addEventListener('click', () => {
        const url = row.dataset.watchUrl;
        if (url) {
          closeModal();
          window.location.href = url;
        }
      });
      // Keyboard support
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          row.click();
        }
      });
    });
  }

  function closeModal() {
    if (activeModal) {
      if (activeModal._onEsc) {
        document.removeEventListener('keydown', activeModal._onEsc);
      }
      activeModal.remove();
      activeModal = null;
    }
    document.body.style.overflow = '';
  }

  // ── Watch page: floating save button ─────────────────────────────────────
  function injectSaveButton() {
    if (document.getElementById('flixlist-save-btn')) return;
    const btn = document.createElement('div');
    btn.id = 'flixlist-save-btn';
    btn.innerHTML = `
      <div class="fl-btn-inner">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="fl-btn-text">Save to FlixList</span>
      </div>
      <div class="fl-toast" id="fl-toast"></div>
    `;
    btn.addEventListener('click', handleSave);
    document.body.appendChild(btn);
  }

  function removeSaveButton() {
    document.getElementById('flixlist-save-btn')?.remove();
  }

  function showToast(msg, type = 'success') {
    const t = document.getElementById('fl-toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `fl-toast fl-toast-${type} fl-toast-show`;
    setTimeout(() => { t.className = 'fl-toast'; }, 3000);
  }

  async function handleSave(e) {
    e.stopPropagation();
    const info = readPageInfo();
    if (!info) { showToast('Couldn't read page info', 'error'); return; }

    const res = await bgMessage('SAVE_ITEM', info);
    if (res?.success) {
      showToast(`Saved to "${res.playlistName}"!`);
    } else if (res?.needsAuth) {
      showToast('Sign in via FlixList extension first', 'info');
    } else if (res?.needsSelect) {
      showToast('Pick a playlist in the extension ↗', 'info');
    } else {
      showToast(res?.error || 'Something went wrong', 'error');
    }
  }

  function readPageInfo() {
    const match = location.pathname.match(/\/watch\/(\d+)/);
    if (!match) return null;

    const titleEl =
      document.querySelector('[data-uia="video-title"] h4') ||
      document.querySelector('[data-uia="video-title"]') ||
      document.querySelector('.ltr-bjn8wh');

    const epEl =
      document.querySelector('[data-uia="video-title"] span') ||
      document.querySelector('.ltr-x1hvkl');

    let seriesTitle = titleEl?.textContent?.trim() || '';
    let episodeLabel = epEl?.textContent?.trim() || '';

    if (!seriesTitle) {
      const docTitle = document.title.replace(' | Netflix', '').trim();
      if (docTitle.includes('·')) {
        const [ep, series] = docTitle.split('·');
        episodeLabel = ep.trim();
        seriesTitle = series?.trim() || docTitle;
      } else {
        seriesTitle = docTitle;
      }
    }

    const seMatch = episodeLabel.match(/[Ss](\d+)[:\s][Ee](\d+)\s*(.*)/);
    return {
      netflixId: match[1],
      netflixUrl: `https://www.netflix.com/watch/${match[1]}`,
      seriesTitle: seriesTitle || 'Unknown Title',
      episodeLabel: episodeLabel || null,
      episodeTitle: seMatch?.[3]?.trim() || null,
      season: seMatch ? parseInt(seMatch[1]) : null,
      episode: seMatch ? parseInt(seMatch[2]) : null,
      posterUrl: document.querySelector('meta[property="og:image"]')?.content || null,
    };
  }

  // ── URL change detection (Netflix SPA) ────────────────────────────────────
  function onUrlChange() {
    const isWatch = /\/watch\/\d+/.test(location.pathname);
    const isBrowse = !isWatch && (
      location.pathname === '/' ||
      location.pathname.startsWith('/browse') ||
      location.pathname.startsWith('/latest') ||
      location.pathname.startsWith('/my-list')
    );

    closeModal();

    if (isWatch) {
      rowInjected = false;
      document.getElementById('flixlist-injected-row')?.remove();
      setTimeout(injectSaveButton, 1800);
    } else {
      removeSaveButton();
      if (isBrowse) {
        rowInjected = false;
        setTimeout(tryInjectRow, 2200);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function esc(s) { return String(s ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function escHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  urlCheckInterval = setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onUrlChange();
    }
  }, 800);

  onUrlChange();

  window.addEventListener('beforeunload', () => {
    clearInterval(urlCheckInterval);
  });

})();
