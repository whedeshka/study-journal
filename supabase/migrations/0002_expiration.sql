-- Add expiration timestamp: end of the actual class + 24 hours (Europe/Riga).
alter table public.tasks add column if not exists expires_at timestamptz;
create or replace function public.set_task_expiry()
returns trigger language plpgsql as $$
declare end_clock time;
begin
  select trim(split_part(replace(l.time,'–','-'),'-',2))::time
    into end_clock from public.lessons l where l.id = new.lesson_id;
  if end_clock is null then raise exception 'Не удалось определить время окончания пары'; end if;
  new.expires_at := ((new.lesson_date::date + end_clock + interval '24 hours') at time zone 'Europe/Riga');
  return new;
end $$;
drop trigger if exists tasks_set_expiry on public.tasks;
create trigger tasks_set_expiry before insert or update of lesson_id, lesson_date on public.tasks
for each row execute function public.set_task_expiry();
-- Backfill if tasks were already created:
update public.tasks t set expires_at=((t.lesson_date + trim(split_part(replace(l.time,'–','-'),'-',2))::time + interval '24 hours') at time zone 'Europe/Riga')
from public.lessons l where l.id=t.lesson_id and t.expires_at is null;
