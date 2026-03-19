-- ============================================================
-- FlixList — Supabase Schema
-- Run this entire file in your Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- 1. Profiles (auto-created on user signup via trigger)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2. Playlists
create table if not exists public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text default '',
  show_name text default '',
  is_public boolean default true,
  like_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.playlists enable row level security;

create policy "Public playlists are viewable by everyone"
  on public.playlists for select using (is_public = true or auth.uid() = user_id);

create policy "Users can create playlists"
  on public.playlists for insert with check (auth.uid() = user_id);

create policy "Users can update own playlists"
  on public.playlists for update using (auth.uid() = user_id);

create policy "Users can delete own playlists"
  on public.playlists for delete using (auth.uid() = user_id);


-- 3. Playlist Items
create table if not exists public.playlist_items (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists on delete cascade,
  netflix_id text,
  netflix_url text,
  title text not null,
  poster_url text,
  season int,
  episode int,
  note text,
  position int default 0,
  created_at timestamptz default now()
);

alter table public.playlist_items enable row level security;

-- Items inherit visibility from their playlist
create policy "Items viewable if playlist is accessible"
  on public.playlist_items for select using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id
      and (p.is_public = true or p.user_id = auth.uid())
    )
  );

create policy "Playlist owners can insert items"
  on public.playlist_items for insert with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

create policy "Playlist owners can update items"
  on public.playlist_items for update using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );

create policy "Playlist owners can delete items"
  on public.playlist_items for delete using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_id and p.user_id = auth.uid()
    )
  );


-- 4. Likes
create table if not exists public.playlist_likes (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  unique (playlist_id, user_id)
);

alter table public.playlist_likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.playlist_likes for select using (true);

create policy "Users can like playlists"
  on public.playlist_likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike"
  on public.playlist_likes for delete using (auth.uid() = user_id);


-- 5. RPC functions for atomic like count updates
create or replace function public.increment_likes(p_id uuid)
returns void as $$
begin
  update public.playlists set like_count = like_count + 1 where id = p_id;
end;
$$ language plpgsql security definer;

create or replace function public.decrement_likes(p_id uuid)
returns void as $$
begin
  update public.playlists set like_count = greatest(like_count - 1, 0) where id = p_id;
end;
$$ language plpgsql security definer;


-- 6. Indexes for performance
create index if not exists idx_playlists_user on public.playlists(user_id);
create index if not exists idx_playlists_public on public.playlists(is_public, created_at desc);
create index if not exists idx_playlists_popular on public.playlists(is_public, like_count desc);
create index if not exists idx_items_playlist on public.playlist_items(playlist_id, position);
create index if not exists idx_likes_playlist on public.playlist_likes(playlist_id);
create index if not exists idx_likes_user on public.playlist_likes(user_id);
