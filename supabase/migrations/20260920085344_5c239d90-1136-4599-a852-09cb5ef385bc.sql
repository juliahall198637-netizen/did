create or replace function public.assign_first_user_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.assign_first_user_admin() from public, anon, authenticated;

create trigger on_auth_user_created_assign_role
after insert on auth.users
for each row execute function public.assign_first_user_admin();