-- Items the speakers said they no longer need are kept in history with status 'notNeeded' and the phrase that caused it.
alter table public.list_items drop constraint if exists list_items_status_check;
alter table public.list_items add constraint list_items_status_check check (status in ('open', 'bought', 'queued', 'notNeeded'));
alter table public.list_items add column if not exists not_needed_text text;
