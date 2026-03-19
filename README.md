# FlixList

**Create and share playlists of Netflix moments.**

FlixList lets you save specific Netflix episodes or movies into playlists and share them.

**Web app** → [flixlist-eight.vercel.app](https://flixlist-eight.vercel.app)  
**Chrome extension** → Coming soon on the Chrome Web Store

---

## What It Does

FlixList is a Chrome extension that lives inside Netflix. When you're watching something, a button appears in the corner. Click it, and a panel slides out where you can save the current episode or movie to any of your playlists. Each saved moment stores the direct Netflix link, so anyone can click it and land on exactly the right video.

You don't need to leave Netflix to use it. The extension handles everything: creating playlists, saving moments, and browsing your collections.

There's also a web app where you can browse public playlists from other users, discover what people are curating, and manage your own playlists from any browser.

### The Flow

1. Install the Chrome extension and sign up
2. Go to Netflix and start watching something
3. Click the **FlixList** button (bottom-right corner)
4. A panel opens, pick a playlist or create a new one
5. The moment is saved with a direct link back to that exact video
6. Share your playlist link, anyone can see it and click through to Netflix

### What You Can Do

- **Save moments** from any Netflix video with one click
- **Browse playlists** inside Netflix without switching tabs
- **Jump to any moment** each item has a play button that opens the Netflix link
- **Create and manage playlists** name them, add descriptions, make them public or private
- **Discover playlists** the web app shows what other users have built
- **Like playlists** you enjoy
- **Search** by show name, playlist title, or description

---

## Screenshots

> *Screenshots coming soon, the extension injects a dark panel that matches Netflix's design language, with playlist browsing, one-click saving, and direct watch links.*

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
5. Go to Netflix, the FlixList button appears on any page

---

## How It's Built

FlixList is a full-stack application with three parts: a Chrome extension for the Netflix integration, a React web app for discovery and management, and a Supabase backend for data and auth.

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Chrome Extension (Manifest V3)                 │
│  ├── content.js → Netflix overlay panel         │
│  ├── background.js → Supabase REST client       │
│  └── popup/ → Auth (sign in / sign up)          │
├─────────────────────────────────────────────────┤
│  Web App (React + Vite + Tailwind)              │
│  ├── Discovery feed with public playlists       │
│  ├── Playlist detail with items + deep links    │
│  ├── User profiles                              │
│  └── Auth (Supabase client-side)                │
├─────────────────────────────────────────────────┤
│  Supabase (Postgres + Auth + RLS)               │
│  ├── playlists, playlist_items, profiles, likes │
│  ├── Row-level security on every table          │
│  ├── Auto-profile creation via DB trigger       │
│  └── Atomic like/unlike via RPC functions       │
└─────────────────────────────────────────────────┘
```

### Technical Decisions

**Netflix SPA handling.** Netflix is a single-page application, navigating between pages doesn't trigger a page reload, so a regular content script would only fire once. The extension polls for URL changes and injects or removes the overlay dynamically based on the current route.

**Two auth paths.** The web app uses the Supabase JS client for auth (session-based, with `onAuthStateChange` listeners). The Chrome extension can't use the same client because it runs in an isolated context, so it talks directly to Supabase's REST auth endpoints and stores the JWT in `chrome.storage.local`. Both paths write to the same database.

**No profiles join.** Supabase's PostgREST auto-detects foreign key relationships for embedded queries, but `playlists.user_id` references `auth.users`, not the `profiles` table. Instead of fighting the ORM, profiles are fetched separately and merged in JavaScript. Simpler, and it never breaks.

**Anonymous read access.** Public playlists are browsable without an account. RLS policies allow `SELECT` on public playlists for unauthenticated requests (using the Supabase anon key), so the discovery feed works for everyone.

**Anon key in the extension.** The Supabase anon key is intentionally hardcoded in the published extension. This is safe because all data access is controlled by Postgres row-level security policies — the key only grants the permissions that RLS allows, which for unauthenticated users is read-only on public data.

### Stack

| Component | Technology |
|---|---|
| Extension | Chrome Manifest V3, vanilla JS |
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Supabase (Postgres, Auth, RLS) |
| Hosting | Vercel (web app) |
| Auth | Supabase email/password, JWT |
| Cost | $0/month on free tiers |

---

## Project Structure

```
flixlist/
├── extension/                # Chrome extension
│   ├── manifest.json         # MV3 configuration
│   ├── background.js         # Service worker: auth + Supabase REST
│   ├── content.js            # Netflix overlay: playlist panel + save button
│   ├── content.css           # Netflix-native dark theme styles
│   └── popup/                # Extension popup for sign in/up
├── web/                      # React web app
│   ├── src/
│   │   ├── pages/            # Home, PlaylistPage, ProfilePage, AuthPage
│   │   ├── components/       # Navbar, PlaylistCard
│   │   ├── lib/supabase.js   # All database operations
│   │   └── hooks/useAuth.js  # Auth state management
│   ├── vercel.json           # SPA routing for Vercel
│   └── package.json
├── supabase/
│   └── schema.sql            # Full schema with RLS policies + triggers
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

Create a Supabase project, then run `supabase/schema.sql` in the SQL Editor. This creates four tables (`profiles`, `playlists`, `playlist_items`, `playlist_likes`), all RLS policies, a profile auto-creation trigger, and atomic like/unlike functions.

### 2. Web App

```bash
cd web
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm install
npm run dev
```

### 3. Extension

Edit `extension/background.js` lines 4-5 with your Supabase credentials, then load unpacked in `chrome://extensions`.

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
