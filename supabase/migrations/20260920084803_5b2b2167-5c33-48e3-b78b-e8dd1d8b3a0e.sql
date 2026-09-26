create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create policy "users read own roles" on public.user_roles
for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = _user_id and role = _role
  )
$$;

create table public.did_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique,
  client_key text not null default '',
  agent_id text not null default '',
  embed_script_url text not null default 'https://agent.d-id.com/v2/index.js',
  mode text not null default 'fabio',
  name text not null default 'did-agent',
  monitor boolean not null default true,
  light_mode boolean not null default false,
  orientation text not null default 'vertical',
  position text not null default 'center',
  open_mode text not null default 'always',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.did_settings to anon;
grant select, insert, update on public.did_settings to authenticated;
grant all on public.did_settings to service_role;
alter table public.did_settings enable row level security;

create policy "anyone can read avatar settings" on public.did_settings
for select using (true);

create policy "admins can insert settings" on public.did_settings
for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));

create policy "admins can update settings" on public.did_settings
for update to authenticated using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger did_settings_updated_at
before update on public.did_settings
for each row execute function public.set_updated_at();

insert into public.did_settings (singleton) values (true);