-- Photos de profil.
--
-- Bucket public : l'URL de l'avatar est diffusée à toute la table via `players.avatar`,
-- il n'y a donc rien de secret à protéger. En revanche, l'ÉCRITURE est verrouillée :
-- le fichier doit s'appeler <auth.uid()>.jpg, ce qui interdit d'écraser la photo d'un
-- autre joueur (ou d'inonder le bucket de fichiers arbitraires).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  524288,  -- 512 Ko : le client redimensionne à 256px avant l'envoi, c'est large.
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 524288,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars are public"      on storage.objects;
drop policy if exists "own avatar upload"       on storage.objects;
drop policy if exists "own avatar update"       on storage.objects;
drop policy if exists "own avatar delete"       on storage.objects;

create policy "avatars are public"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- storage.foldername(name)[1] = le premier segment du chemin. On impose
-- "<uid>/photo.jpg" : un joueur ne peut écrire que dans SON dossier.
create policy "own avatar upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own avatar update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "own avatar delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
