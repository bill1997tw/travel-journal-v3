create table if not exists public.app_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  logo_text text not null default '旅遊小本本',
  user_name text not null default '旅人',
  theme text not null default 'light' check (theme in ('light', 'dark')),
  trips jsonb not null default '[]'::jsonb,
  quick_notes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_app_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_touch_app_states_updated_at on public.app_states;
create trigger trg_touch_app_states_updated_at
before update on public.app_states
for each row
execute function public.touch_app_states_updated_at();

alter table public.app_states enable row level security;

drop policy if exists "Users can read their own app state" on public.app_states;
create policy "Users can read their own app state"
on public.app_states
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own app state" on public.app_states;
create policy "Users can insert their own app state"
on public.app_states
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own app state" on public.app_states;
create policy "Users can update their own app state"
on public.app_states
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('travel-assets', 'travel-assets', false)
on conflict (id) do nothing;

drop policy if exists "Users can upload their own travel assets" on storage.objects;
create policy "Users can upload their own travel assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'travel-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can read their own travel assets" on storage.objects;
create policy "Users can read their own travel assets"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'travel-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update their own travel assets" on storage.objects;
create policy "Users can update their own travel assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'travel-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'travel-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete their own travel assets" on storage.objects;
create policy "Users can delete their own travel assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'travel-assets'
  and auth.uid()::text = (storage.foldername(name))[1]
);
