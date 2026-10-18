create extension if not exists "pgcrypto";

-- profiles: the one app table allowed to reference auth.users directly
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  native_language text default 'en',
  learning_language text default 'es',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.translation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  original_text text not null,
  source_language text,
  target_language text not null,
  translated_text text,
  provider text default 'lovable-ai',
  status text not null default 'success',
  created_at timestamptz not null default now()
);
create index th_user_created on public.translation_history(user_id, created_at desc);

create table public.speaking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  language text not null,
  target_sentence text not null,
  transcript text,
  created_at timestamptz not null default now()
);
create index ss_user_created on public.speaking_sessions(user_id, created_at desc);

create table public.learning_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  session_id uuid references public.speaking_sessions(id) on delete cascade,
  kind text not null,
  input_text text,
  feedback text not null,
  created_at timestamptz not null default now()
);
create index lf_user_created on public.learning_feedback(user_id, created_at desc);

create table public.conversation_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('user','assistant')),
  content text not null,
  language text not null,
  created_at timestamptz not null default now()
);
create index ch_user_created on public.conversation_history(user_id, created_at);

create table public.user_progress (
  user_id uuid primary key,
  translations_count int not null default 0,
  practice_count int not null default 0,
  learning_goal text,
  summary text,
  updated_at timestamptz not null default now()
);

create table public.saved_vocabulary (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  word text not null,
  meaning text,
  example text,
  language text,
  review_status text not null default 'new',
  created_at timestamptz not null default now()
);
create index sv_user on public.saved_vocabulary(user_id, created_at desc);

-- Data API access (RLS alone is not enough)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.translation_history TO authenticated;
GRANT ALL ON public.translation_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speaking_sessions TO authenticated;
GRANT ALL ON public.speaking_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_feedback TO authenticated;
GRANT ALL ON public.learning_feedback TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_history TO authenticated;
GRANT ALL ON public.conversation_history TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_progress TO authenticated;
GRANT ALL ON public.user_progress TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_vocabulary TO authenticated;
GRANT ALL ON public.saved_vocabulary TO service_role;

-- Each user sees only their own rows
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "own rows" ON public.translation_history FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.speaking_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.learning_feedback FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.conversation_history FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.user_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own rows" ON public.saved_vocabulary FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Auto-create profile + progress row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  insert into public.user_progress (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();