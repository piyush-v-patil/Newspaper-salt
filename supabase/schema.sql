-- Life Of Pi: sync storage. Run once in the Supabase SQL editor.
--
-- Every record the app keeps (a task, a subtask, a setting...) is one row,
-- tagged with its owner. Row-level security means a signed-in person can
-- only ever read or write their own rows, so more people can sign up later
-- without any change here.

create table if not exists public.records (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  tbl        text    not null,              -- which kind of record: 'tasks', 'subtasks', 'meta', ...
  id         text    not null,              -- the record's own id
  data       jsonb,                         -- the record; null once deleted
  deleted    boolean not null default false,
  changed_at bigint  not null,              -- when the device changed it (ms since 1970); the latest change wins
  seq        bigint  not null,              -- server order, so each device can ask "what changed since I last looked?"
  primary key (user_id, tbl, id)
);

create sequence if not exists public.records_seq;

create index if not exists records_user_seq on public.records (user_id, seq);

alter table public.records enable row level security;

drop policy if exists "own rows" on public.records;
create policy "own rows" on public.records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Saves a batch of changes from a device. A change older than what is already
-- stored for that record is ignored, so the most recent edit always wins.
create or replace function public.push_records(changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  change jsonb;
begin
  for change in select * from jsonb_array_elements(changes) loop
    insert into public.records as r (user_id, tbl, id, data, deleted, changed_at, seq)
    values (
      auth.uid(),
      change->>'tbl',
      change->>'id',
      case when (change->>'deleted')::boolean then null else change->'data' end,
      coalesce((change->>'deleted')::boolean, false),
      (change->>'changed_at')::bigint,
      nextval('public.records_seq')
    )
    on conflict (user_id, tbl, id) do update
      set data = excluded.data,
          deleted = excluded.deleted,
          changed_at = excluded.changed_at,
          seq = excluded.seq
      where r.changed_at <= excluded.changed_at;
  end loop;
end;
$$;

revoke all on public.records from anon;
revoke execute on function public.push_records(jsonb) from anon, public;
grant usage on sequence public.records_seq to authenticated;
grant select, insert, update, delete on public.records to authenticated;
grant execute on function public.push_records(jsonb) to authenticated;
