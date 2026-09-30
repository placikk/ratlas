-- Zdjęcia zgłoszeń. Zapisuje wyłącznie Edge Function (service_role).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('map-photos', 'map-photos', true, 3145728, array['image/jpeg']),
  ('sightings-private', 'sightings-private', false, 3145728, array['image/jpeg']);

-- Autor może obejrzeć swoje prywatne zdjęcia (np. selfie) — ścieżka zaczyna się od jego id.
create policy "sightings-private: owner can read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'sightings-private'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
