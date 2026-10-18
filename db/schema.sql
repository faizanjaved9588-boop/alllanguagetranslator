-- All Language Translator & Editor — run in Supabase SQL editor
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  native_language text default 'en',
  learning_language text default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.translation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  original_text text not null,
  source_language text,
  target_language text not null,
  translated_text text,
  provider text default 'lovable-ai',
  status text not null default 'success',
  created_at timestamptz not null default now()
);
create index if not exists th_user_created on public.translation_history(user_id, created_at desc);

create table if not exists public.speaking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  language text not null,
  target_sentence text not null,
  transcript text,
  created_at timestamptz not null default now()
);
create index if not exists ss_user_created on public.speaking_sessions(user_id, created_at desc);

create table if not exists public.learning_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.speaking_sessions(id) on delete cascade,
  kind text not null, -- 'grammar' | 'speaking'
  input_text text,
  feedback text not null,
  created_at timestamptz not null default now()
);
create index if not exists lf_user_created on public.learning_feedback(user_id, created_at desc);

create table if not exists public.conversation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  language text not null,
  created_at timestamptz not null default now()
);
create index if not exists ch_user_created on public.conversation_history(user_id, created_at);

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  translations_count int not null default 0,
  practice_count int not null default 0,
  learning_goal text,
  summary text,
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  meaning text,
  example text,
  language text,
  review_status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists sv_user on public.saved_vocabulary(user_id, created_at desc);

-- Row Level Security: each user only sees their own rows
alter table public.profiles enable row level security;
alter table public.translation_history enable row level security;
alter table public.speaking_sessions enable row level security;
alter table public.learning_feedback enable row level security;
alter table public.conversation_history enable row level security;
alter table public.user_progress enable row level security;
alter table public.saved_vocabulary enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['translation_history','speaking_sessions','learning_feedback','conversation_history','user_progress','saved_vocabulary'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Auto-create profile + progress row on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  insert into public.user_progress (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
