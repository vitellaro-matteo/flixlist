# FlixList

**Create and share playlists of Netflix moments.**

FlixList lets you save specific Netflix episodes or movies into playlists and share them.

**Web app** → [flixlist-eight.vercel.app](https://flixlist-eight.vercel.app)  
**Chrome extension** → Coming soon on the Chrome Web Store

---

## What It Does

FlixList is a Chrome extension that lives inside Netflix. When you're watching something, a button appears in the corner. Click it, and a panel slides out where you can save the current episode or movie to any of your playlists. Each saved moment stores the direct Netflix link, so anyone can click it and land on exactly the right video.

You don't need to leave Netflix to use it. The extension handles everything: creating playlists, saving moments, browsing your collections, and renaming items — all in a panel that sits on top of the Netflix UI.

There's also a web app where you can browse public playlists from other users, discover what people are curating, leave comments, and manage your own playlists from any browser.

### The Flow

1. Install the Chrome extension and sign up
2. Go to Netflix and start watching something
3. Click the **FlixList** button (bottom-right corner)
4. A panel opens — pick a playlist or create a new one
5. The moment is saved with a direct link back to that exact video
6. Share your playlist link — anyone can see it and click through to Netflix

### Features

**Chrome Extension (inside Netflix)**
- Save the current video to any playlist with one click
- Browse all your playlists without leaving Netflix
- Open any playlist to see its items, each with a play button that jumps directly to that Netflix video
- Create new playlists inline
- Rename saved items directly in the extension panel
- Works on all Netflix pages — the panel adapts to show save options on watch pages
- Handles Netflix's single-page app navigation (detects URL changes without page reload)
- Keeps Netflix's cursor and controls visible while the panel is open
- Blocks Netflix keyboard shortcuts (space, F, etc.) while typing in the panel
- Automatic JWT token refresh — sessions don't expire while you're using the extension

**Web App**
- Discovery feed showing public playlists from all users, sorted by recent or popular
- Playlist detail view with numbered items, season/episode tags, notes, and Netflix deep-links
- Reorder items within a playlist using up/down arrows (persisted to database)
- Inline rename of playlist items (click pencil icon, edit, press Enter)
- Edit playlist title and description
- Comments on playlists — anyone signed in can comment, authors can delete their own
- Like/unlike playlists with atomic counters
- Search playlists by title, show name, or description
- User profiles showing all public playlists and stats
- Public/private playlist toggle
- Share playlist via clipboard link
- Full auth with email and password
- Anonymous browsing — public playlists visible without signing in
- Responsive dark UI

---

## Screenshots

> *Screenshots coming soon — the extension injects a dark panel that matches Netflix's design language, with playlist browsing, one-click saving, and direct watch links.*

---

## Try It

### Web App

Visit [flixlist-eight.vercel.app](https://flixlist-eight.vercel.app) to browse public playlists, create an account, and manage your own playlists.

### Chrome Extension (Manual Install)

The extension isn't on the Chrome Web Store yet. To try it now:

1. Clone this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the `extension/` folder
5. Go to Netflix — the FlixList button appears on any page

---

## How It's Built

FlixList is a full-stack application with three parts: a Chrome extension for the Netflix integration, a React web app for discovery and management, and a Supabase backend for data and auth.

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                 │
│  ├── content.js → Netflix overlay panel         │
│  │   ├── Save current video to playlist         │
│  │   ├── Browse playlists + items               │
│  │   ├── Rename items inline                    │
│  │   ├── SPA navigation detection               │
│  │   └── Cursor keep-alive + keyboard blocking  │
│  ├── background.js → Supabase REST client       │
│  │   ├── JWT storage + automatic refresh        │
│  │   └── All CRUD operations via REST API       │
│  └── popup/ → Auth (sign in / sign up)          │
├─────────────────────────────────────────────────┤
│  Web App (React + Vite + Tailwind)              │
│  ├── Discovery feed (recent / popular)          │
│  ├── Playlist detail + items + reorder          │
│  ├── Comments system                            │
│  ├── User profiles                              │
│  ├── Search                                     │
│  └── Auth (Supabase client-side)                │
├─────────────────────────────────────────────────┤
│  Supabase (Postgres + Auth + RLS)               │
│  ├── playlists, playlist_items, profiles        │
│  ├── playlist_likes, playlist_comments          │
│  ├── Row-level security on every table          │
│  ├── Auto-profile creation via DB trigger       │
│  └── Atomic like/unlike via RPC functions       │
└─────────────────────────────────────────────────┘
```

### Technical Decisions

**Netflix SPA handling.** Netflix is a single-page application — navigating between pages doesn't trigger a page reload, so a regular content script would only fire once. The extension polls for URL changes and injects or removes the overlay dynamically based on the current route.

**Cursor keep-alive.** Netflix hides the mouse cursor and player controls after a few seconds of inactivity during video playback. The extension dispatches synthetic `mousemove` events while the panel is open, preventing Netflix from hiding the UI. It also captures all keyboard events at the root level so Netflix shortcuts (space for pause, F for fullscreen) don't fire while the user is typing in input fields.

**Two auth paths.** The web app uses the Supabase JS client for auth (session-based, with `onAuthStateChange` listeners). The Chrome extension can't use the same client because it runs in an isolated context, so it talks directly to Supabase's REST auth endpoints and stores the JWT in `chrome.storage.local`. Both paths write to the same database.

**Automatic token refresh.** Supabase JWTs expire after one hour. The extension decodes the JWT payload to check the `exp` claim before every API call. If the token is within 30 seconds of expiry, it uses the stored refresh token to get a new access token transparently. If refresh fails (e.g., after a long period of inactivity), it clears the session and shows a sign-in prompt instead of a cryptic error.

**No profiles join.** Supabase's PostgREST auto-detects foreign key relationships for embedded queries, but `playlists.user_id` references `auth.users`, not the `profiles` table. Instead of fighting the ORM, profiles are fetched separately and merged in JavaScript.

**Stable item ordering.** Playlist items are sorted once on load and stored in a separate state variable. Rename and reorder operations mutate this array directly without triggering a re-sort, so the list stays stable while the user is editing. Reorder persists position values to the database.

**Anonymous read access.** Public playlists are browsable without an account. RLS policies allow `SELECT` on public playlists for unauthenticated requests (using the Supabase anon key), so the discovery feed works for everyone.

**Anon key in the extension.** The Supabase anon key is intentionally hardcoded in the published extension. This is safe because all data access is controlled by Postgres row-level security policies — the key only grants the permissions that RLS allows, which for unauthenticated users is read-only on public data.

### Stack

| Component | Technology |
|---|---|
| Extension | Chrome Manifest V3, vanilla JS |
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Supabase (Postgres, Auth, RLS) |
| Hosting | Vercel (web app) |
| Auth | Supabase email/password, JWT with refresh |
| Cost | $0/month on free tiers |

---

## Project Structure

```
flixlist/
├── extension/                # Chrome extension
│   ├── manifest.json         # MV3 configuration
│   ├── background.js         # Service worker: auth, token refresh, Supabase REST
│   ├── content.js            # Netflix overlay: panel, save, browse, rename, keep-alive
│   ├── content.css           # Netflix-native dark theme styles
│   └── popup/                # Extension popup for sign in/up
├── web/                      # React web app
│   ├── src/
│   │   ├── pages/            # Home, PlaylistPage, ProfilePage, AuthPage
│   │   ├── components/       # Navbar, PlaylistCard
│   │   ├── lib/supabase.js   # All database operations (playlists, items, likes, comments)
│   │   └── hooks/useAuth.js  # Auth state management
│   ├── vercel.json           # SPA routing for Vercel
│   └── package.json
├── supabase/
│   ├── schema.sql            # Full schema with RLS policies + triggers
│   └── add-comments.sql      # Comments table migration
└── README.md
```

---

## Development Setup

If you want to run this locally or fork it:

### Prerequisites
- Node.js 18+
- A free [Supabase](https://supabase.com) project
- Chrome or Chromium browser

### 1. Database

Create a Supabase project, then run `supabase/schema.sql` followed by `supabase/add-comments.sql` in the SQL Editor. This creates five tables (`profiles`, `playlists`, `playlist_items`, `playlist_likes`, `playlist_comments`), all RLS policies, a profile auto-creation trigger, and atomic like/unlike functions.

Set the **Site URL** in Authentication → URL Configuration to your deployed URL (e.g., `https://flixlist-eight.vercel.app`) to fix email confirmation redirects.

### 2. Web App

```bash
cd web
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm install
npm run dev
```

### 3. Extension

Edit `extension/background.js` lines 4–5 with your Supabase URL and anon key, then load unpacked in `chrome://extensions`.

### 4. Deploy

**Web app:** Push to GitHub, import in Vercel, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.

**Extension:** Zip the `extension/` folder and submit to the [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Roadmap

- [ ] Chrome Web Store publication
- [ ] Subtitle search — find moments by dialogue using OpenSubtitles
- [ ] Collaborative playlists — invite others to add moments
- [ ] Timestamp support — save the exact minute within an episode
- [ ] Social features — follow users, activity feed
- [ ] Firefox extension

---

## License

MIT

---

Built by [Matteo Vitellaro](https://github.com/vitellaro-matteo)
