-- ============================================================
-- FlixList — RLS Fix Patch
-- Run this in your Supabase SQL Editor if playlists aren't
-- showing up on the home page or playlist detail page.
-- ============================================================

-- 1. Drop and recreate the playlists SELECT policy
-- The old policy may block anon/non-owner reads on public playlists
DROP POLICY IF EXISTS "Public playlists are viewable by everyone" ON public.playlists;

CREATE POLICY "Public playlists are viewable by everyone"
  ON public.playlists FOR SELECT
  USING (
    is_public = true
    OR auth.uid() = user_id
  );

-- 2. Ensure playlist_items are readable when parent playlist is accessible
DROP POLICY IF EXISTS "Items viewable if playlist is accessible" ON public.playlist_items;

CREATE POLICY "Items viewable if playlist is accessible"
  ON public.playlist_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.playlists p
      WHERE p.id = playlist_id
      AND (p.is_public = true OR p.user_id = auth.uid())
    )
  );

-- 3. Ensure profiles are publicly readable (needed for author names)
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

-- 4. Verify: check if your playlists exist and are public
SELECT id, title, is_public, user_id, created_at
FROM public.playlists
ORDER BY created_at DESC
LIMIT 10;
