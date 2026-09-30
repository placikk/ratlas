begin;
select plan(3);

select is(
  (select public from storage.buckets where id = 'map-photos'),
  true,
  'zdjęcia na mapę są publiczne'
);

select is(
  (select public from storage.buckets where id = 'sightings-private'),
  false,
  'pozostałe zdjęcia są prywatne'
);

select is(
  (select allowed_mime_types from storage.buckets where id = 'sightings-private'),
  array['image/jpeg'],
  'przyjmujemy tylko JPEG'
);

select * from finish();
rollback;
