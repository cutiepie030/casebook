-- Run as the project administrator. No passwords or private cases belong in this file.
create table if not exists public.casebook_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.casebook_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  payload jsonb,
  updated_at timestamptz not null default now()
);
alter table public.casebook_members enable row level security;
alter table public.casebook_vaults enable row level security;
revoke all on public.casebook_members, public.casebook_vaults from anon, authenticated;
grant select on public.casebook_members, public.casebook_vaults to authenticated;
drop policy if exists own_membership on public.casebook_members;
create policy own_membership on public.casebook_members for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists own_vault on public.casebook_vaults;
create policy own_vault on public.casebook_vaults for select to authenticated using (
 user_id = (select auth.uid()) and exists(select 1 from public.casebook_members m where m.user_id = (select auth.uid()))
);
grant insert, update on public.casebook_vaults to authenticated;
create policy own_vault_insert on public.casebook_vaults for insert to authenticated with check (
 user_id = (select auth.uid()) and exists(select 1 from public.casebook_members m where m.user_id=(select auth.uid()))
);
create policy own_vault_update on public.casebook_vaults for update to authenticated using (
 user_id = (select auth.uid()) and exists(select 1 from public.casebook_members m where m.user_id=(select auth.uid()))
) with check (
 user_id = (select auth.uid()) and exists(select 1 from public.casebook_members m where m.user_id=(select auth.uid()))
);
-- The application uses this atomic save so a stale device cannot overwrite a newer version.
create or replace function public.casebook_save(expected_revision bigint, new_payload jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); result bigint;
begin
 if uid is null or not exists(select 1 from public.casebook_members where user_id=uid) then
   raise exception 'Access denied' using errcode='42501';
 end if;
 if new_payload->>'format' is distinct from 'CASEBOOK' or new_payload->>'schemaVersion' is distinct from '1'
 or jsonb_typeof(new_payload->'docs') is distinct from 'array'
 or jsonb_typeof(new_payload->'links') is distinct from 'array'
 or jsonb_typeof(new_payload->'sessions') is distinct from 'array'
 or octet_length(new_payload::text) > 26214400 then raise exception 'Invalid backup'; end if;
 insert into public.casebook_vaults(user_id) values(uid) on conflict do nothing;
 update public.casebook_vaults set payload=new_payload, revision=revision+1, updated_at=now()
 where user_id=uid and revision=expected_revision returning revision into result;
 if result is null then raise exception 'CASEBOOK_CONFLICT' using errcode='40001'; end if;
 return result;
end;
$$;
revoke all on function public.casebook_save(bigint,jsonb) from public, anon;
grant execute on function public.casebook_save(bigint,jsonb) to authenticated;
