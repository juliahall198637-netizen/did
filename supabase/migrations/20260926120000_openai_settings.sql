-- OpenAI speech-to-text settings. The API key is a secret: only the server
-- (service_role) may read or write this table. The admin panel reaches it
-- through server functions and never receives the stored key back.
create table public.openai_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  api_key text not null default '',
  stt_model text not null default 'gpt-4o-transcribe',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

revoke all on public.openai_settings from anon, authenticated;
grant all on public.openai_settings to service_role;
alter table public.openai_settings enable row level security;

create trigger openai_settings_updated_at
before update on public.openai_settings
for each row execute function public.set_updated_at();

insert into public.openai_settings (singleton) values (true);
