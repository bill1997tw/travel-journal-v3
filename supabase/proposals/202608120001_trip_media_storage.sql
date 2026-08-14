-- LOCAL PROPOSAL ONLY. Do not apply without a separate production approval.
-- Reuses the existing private travel-assets bucket. New trip media paths are:
--   {uploader_user_id}/trips/{trip_id}/{media_uuid}.{extension}

begin;

insert into storage.buckets (id, name, public)
values ('travel-assets', 'travel-assets', false)
on conflict (id) do update set public = false;

drop policy if exists trip_media_insert_editor on storage.objects;
create policy trip_media_insert_editor
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'travel-assets'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/trips/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'trips'
    and exists (
      select 1
      from public.trip_members member
      where member.trip_id::text = (storage.foldername(name))[3]
        and member.user_id = auth.uid()
        and member.role in ('owner', 'editor')
    )
  );

drop policy if exists trip_media_select_member on storage.objects;
create policy trip_media_select_member
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'travel-assets'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/trips/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and (storage.foldername(name))[2] = 'trips'
    and exists (
      select 1
      from public.trip_members member
      where member.trip_id::text = (storage.foldername(name))[3]
        and member.user_id = auth.uid()
    )
  );

drop policy if exists trip_media_update_uploader_editor on storage.objects;
create policy trip_media_update_uploader_editor
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'travel-assets'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/trips/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'trips'
    and exists (
      select 1
      from public.trip_members member
      where member.trip_id::text = (storage.foldername(name))[3]
        and member.user_id = auth.uid()
        and member.role in ('owner', 'editor')
    )
  )
  with check (
    bucket_id = 'travel-assets'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/trips/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'trips'
    and exists (
      select 1
      from public.trip_members member
      where member.trip_id::text = (storage.foldername(name))[3]
        and member.user_id = auth.uid()
        and member.role in ('owner', 'editor')
    )
  );

drop policy if exists trip_media_delete_uploader_editor on storage.objects;
create policy trip_media_delete_uploader_editor
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'travel-assets'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/trips/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'trips'
    and exists (
      select 1
      from public.trip_members member
      where member.trip_id::text = (storage.foldername(name))[3]
        and member.user_id = auth.uid()
        and member.role in ('owner', 'editor')
    )
  );

commit;
