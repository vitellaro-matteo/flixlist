-- ============================================================
-- FlixList — Add comments + item rename support
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Comments table
CREATE TABLE IF NOT EXISTS public.playlist_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES public.playlists ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.playlist_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments on public playlists
CREATE POLICY "Comments readable on public playlists"
  ON public.playlist_comments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.is_public = true)
    OR auth.uid() = user_id
  );

-- Signed-in users can comment
CREATE POLICY "Authenticated users can comment"
  ON public.playlist_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.playlist_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast comment lookups
CREATE INDEX IF NOT EXISTS idx_comments_playlist ON public.playlist_comments(playlist_id, created_at DESC);

-- 2. Ensure playlist_items can be updated by playlist owner (for rename)
-- The existing update policy should already handle this, but let's be safe
DROP POLICY IF EXISTS "Playlist owners can update items" ON public.playlist_items;
CREATE POLICY "Playlist owners can update items"
  ON public.playlist_items FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.playlists p WHERE p.id = playlist_id AND p.user_id = auth.uid())
  );

-- 3. Fix email confirmation redirect
-- Go to Supabase Dashboard → Authentication → URL Configuration
-- Set "Site URL" to: https://flixlist-eight.vercel.app
-- Set "Redirect URLs" to: https://flixlist-eight.vercel.app/**
-- This fixes the localhost:3000 redirect issue.

SELECT 'Migration complete. Remember to update URL Configuration in Supabase Dashboard.' AS status;
