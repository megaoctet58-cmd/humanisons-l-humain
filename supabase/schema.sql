-- =====================================================================
-- HUMANISONS L'HUMAIN — base partagée (Supabase / PostgreSQL)
--
-- À copier-coller en entier dans Supabase : « SQL Editor » → « New query »
-- → coller → « Run ». Le script peut être relancé sans danger (il ne
-- supprime aucune donnée).
--
-- Principe de sécurité (RLS = règles d'accès vérifiées par la base) :
--  • Un visiteur ne lit QUE les publications publiées (ou programmées dont
--    l'heure est passée). Jamais les contributions en attente.
--  • Les données privées (e-mail, justificatifs, notes de modération,
--    message à l'auteur, demande de retrait) sont dans une table à part,
--    lisible uniquement par l'administrateur.
--  • Les fichiers (voix, images, justificatifs) sont dans un espace privé.
--    Un visiteur ne peut télécharger que les images et les voix des
--    publications publiées dont l'auteur a autorisé la diffusion de la voix.
--  • Un contributeur anonyme ne peut que DÉPOSER une contribution (en attente),
--    suivre son statut et demander son retrait grâce à un jeton secret gardé
--    sur son appareil. Il ne peut rien lire d'autre.
--  • Seules les personnes inscrites dans la table « admins » administrent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id text primary key check (char_length(id) between 3 and 80),
  status text not null check (status in ('en_attente', 'en_verification', 'infos_demandees', 'valide', 'programme', 'publie', 'refuse', 'archive', 'retire')),
  -- Contenu public de la publication (titre, texte, voix, images, sources…).
  data jsonb not null,
  published_at timestamptz,
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_status_idx on public.posts (status);

-- Données privées : jamais lisibles publiquement.
create table if not exists public.post_private (
  post_id text primary key references public.posts (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  -- Empreinte (sha256) du jeton secret du contributeur. Le jeton lui-même n'est jamais stocké.
  owner_token_hash text
);

create table if not exists public.reports (
  id text primary key default gen_random_uuid()::text,
  post_id text not null,
  reason text not null,
  details text,
  status text not null default 'ouvert' check (status in ('ouvert', 'traite', 'rejete')),
  created_at timestamptz not null default now()
);

-- Petites valeurs publiques : catégories, paramètres.
create table if not exists public.app_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Fonctions utilitaires
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

create or replace function public.hlh_is_public(p_status text, p_scheduled timestamptz)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_status = 'publie' or (p_status = 'programme' and p_scheduled is not null and p_scheduled <= now());
$$;

create or replace function public.hlh_hash(p_token text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
$$;

-- Un fichier est public s'il est une image d'une publication publique, ou la voix
-- d'une publication publique dont l'auteur a autorisé la diffusion. Jamais un justificatif.
create or replace function public.media_is_public(p_media text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where public.hlh_is_public(p.status, p.scheduled_at)
      and (
        p.data -> 'images' @> jsonb_build_array(jsonb_build_object('id', p_media))
        or (p.data -> 'audio' ->> 'id' = p_media and coalesce((p.data -> 'audio' ->> 'publishVoice')::boolean, false))
      )
  );
$$;

-- Un contributeur peut envoyer un fichier seulement s'il est déclaré dans une
-- contribution en attente déposée (ou complétée) depuis moins d'un jour.
create or replace function public.media_upload_allowed(p_media text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    left join public.post_private pp on pp.post_id = p.id
    where p.status = 'en_attente'
      and p.updated_at > now() - interval '1 day'
      and (
        p.data -> 'images' @> jsonb_build_array(jsonb_build_object('id', p_media))
        or p.data -> 'audio' ->> 'id' = p_media
        or coalesce(pp.data -> 'proofs', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_media))
      )
  );
$$;

-- ---------------------------------------------------------------------
-- 3. Actions autorisées aux visiteurs (sans compte)
-- ---------------------------------------------------------------------

-- Déposer une contribution, la corriger tant qu'elle attend la modération, ou la
-- compléter quand la modération a demandé des informations. Renvoie le statut obtenu.
create or replace function public.submit_contribution(p_id text, p_data jsonb, p_private jsonb, p_token text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.posts%rowtype;
  v_hash text;
  v_data jsonb;
  v_priv jsonb;
  v_verif text;
begin
  if p_token is null or char_length(p_token) < 24 or char_length(p_token) > 200 then
    raise exception 'Jeton invalide.';
  end if;
  if p_id is null or char_length(p_id) < 3 or char_length(p_id) > 80 then
    raise exception 'Identifiant invalide.';
  end if;
  if jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 200000 then
    raise exception 'Contribution trop volumineuse.';
  end if;
  if coalesce(char_length(p_data ->> 'title'), 0) = 0 or char_length(p_data ->> 'title') > 300 then
    raise exception 'Titre manquant ou trop long.';
  end if;
  p_private := coalesce(p_private, '{}'::jsonb);
  if jsonb_typeof(p_private) <> 'object' or octet_length(p_private::text) > 20000 then
    raise exception 'Informations privées invalides.';
  end if;

  -- Protection simple contre les envois massifs.
  if (select count(*) from public.posts where status = 'en_attente' and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Trop de contributions reçues en ce moment. Réessayez dans une heure.';
  end if;

  -- Le contributeur ne choisit ni le statut, ni la qualité de fondateur, ni la vérification.
  v_verif := case when p_data ->> 'verification' = 'a_documenter' then 'a_documenter' else 'non_verifie' end;
  v_data := (p_data - 'id' - 'status' - 'private' - 'mine' - 'publishedAt' - 'scheduledAt' - 'byFounder' - 'demo')
            || jsonb_build_object('byFounder', false, 'demo', false, 'verification', v_verif);
  -- Seuls l'e-mail et les justificatifs viennent du contributeur.
  v_priv := jsonb_strip_nulls(jsonb_build_object('email', left(p_private ->> 'email', 320), 'proofs', p_private -> 'proofs'));
  v_hash := public.hlh_hash(p_token);

  select * into v_existing from public.posts where id = p_id;
  if not found then
    insert into public.posts (id, status, data) values (p_id, 'en_attente', v_data);
    insert into public.post_private (post_id, data, owner_token_hash) values (p_id, v_priv, v_hash);
    return 'en_attente';
  end if;

  if not exists (select 1 from public.post_private where post_id = p_id and owner_token_hash = v_hash) then
    raise exception 'Cette contribution ne vous appartient pas.';
  end if;
  if v_existing.status not in ('en_attente', 'infos_demandees') then
    raise exception 'Cette contribution ne peut plus être modifiée.';
  end if;
  update public.posts set data = v_data, status = 'en_attente', updated_at = now() where id = p_id;
  -- Les notes et le message de la modération sont conservés.
  update public.post_private set data = (data - 'email' - 'proofs') || v_priv where post_id = p_id;
  return 'en_attente';
end;
$$;

-- Suivre ses propres contributions (identifiant + jeton gardés sur l'appareil).
create or replace function public.my_contributions(p_items jsonb)
returns table (id text, status text, data jsonb, published_at timestamptz, scheduled_at timestamptz, updated_at timestamptz, message_to_author text, withdrawal_requested boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.status, p.data, p.published_at, p.scheduled_at, p.updated_at,
         pp.data ->> 'messageToAuthor',
         coalesce((pp.data ->> 'withdrawalRequested')::boolean, false)
  from (
    select i ->> 'id' as id, i ->> 'token' as token
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) with ordinality as t (i, n)
    where n <= 200
  ) q
  join public.posts p on p.id = q.id
  join public.post_private pp on pp.post_id = p.id and pp.owner_token_hash = public.hlh_hash(q.token);
$$;

-- Demander le retrait de sa contribution.
create or replace function public.request_withdrawal(p_id text, p_token text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.post_private
  set data = data || jsonb_strip_nulls(jsonb_build_object('withdrawalRequested', true, 'withdrawalReason', nullif(left(coalesce(p_reason, ''), 2000), '')))
  where post_id = p_id and owner_token_hash = public.hlh_hash(p_token);
  if not found then
    raise exception 'Contribution introuvable.';
  end if;
end;
$$;

-- Signaler une publication publique.
create or replace function public.report_post(p_post_id text, p_reason text, p_details text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts p where p.id = p_post_id and public.hlh_is_public(p.status, p.scheduled_at)) then
    raise exception 'Publication introuvable.';
  end if;
  if (select count(*) from public.reports where created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Trop de signalements en ce moment. Réessayez plus tard.';
  end if;
  insert into public.reports (post_id, reason, details)
  values (p_post_id, left(coalesce(p_reason, 'Autre'), 200), nullif(left(coalesce(p_details, ''), 2000), ''));
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Règles d'accès (RLS)
-- ---------------------------------------------------------------------

alter table public.admins enable row level security;
alter table public.posts enable row level security;
alter table public.post_private enable row level security;
alter table public.reports enable row level security;
alter table public.app_kv enable row level security;

-- admins : chacun peut seulement vérifier s'il est lui-même administrateur.
drop policy if exists "admins lecture de soi" on public.admins;
create policy "admins lecture de soi" on public.admins for select to authenticated using (user_id = auth.uid());

-- posts : lecture publique des seules publications visibles ; tout pour l'admin.
drop policy if exists "posts lecture publique" on public.posts;
create policy "posts lecture publique" on public.posts for select to anon, authenticated
  using (public.hlh_is_public(status, scheduled_at) or public.is_admin());
drop policy if exists "posts admin ajout" on public.posts;
create policy "posts admin ajout" on public.posts for insert to authenticated with check (public.is_admin());
drop policy if exists "posts admin modification" on public.posts;
create policy "posts admin modification" on public.posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "posts admin suppression" on public.posts;
create policy "posts admin suppression" on public.posts for delete to authenticated using (public.is_admin());

-- post_private, reports : administrateur uniquement.
drop policy if exists "prive admin" on public.post_private;
create policy "prive admin" on public.post_private for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "signalements admin" on public.reports;
create policy "signalements admin" on public.reports for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- app_kv : lecture publique, écriture admin.
drop policy if exists "kv lecture publique" on public.app_kv;
create policy "kv lecture publique" on public.app_kv for select to anon, authenticated using (true);
drop policy if exists "kv admin ecriture" on public.app_kv;
create policy "kv admin ecriture" on public.app_kv for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Droits de base (la RLS ci-dessus filtre ensuite ligne par ligne).
revoke all on public.admins, public.posts, public.post_private, public.reports, public.app_kv from anon;
grant select on public.posts, public.app_kv to anon;
grant select, insert, update, delete on public.posts, public.post_private, public.reports, public.app_kv to authenticated;
grant select on public.admins to authenticated;

grant execute on function public.is_admin(), public.hlh_is_public(text, timestamptz), public.hlh_hash(text),
  public.media_is_public(text), public.media_upload_allowed(text),
  public.submit_contribution(text, jsonb, jsonb, text), public.my_contributions(jsonb),
  public.request_withdrawal(text, text, text), public.report_post(text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Fichiers : espace privé « media » (50 Mo max par fichier)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "hlh media lecture" on storage.objects;
create policy "hlh media lecture" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media' and (public.is_admin() or public.media_is_public(name)));

drop policy if exists "hlh media envoi" on storage.objects;
create policy "hlh media envoi" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'media' and (public.is_admin() or public.media_upload_allowed(name)));

drop policy if exists "hlh media modification" on storage.objects;
create policy "hlh media modification" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "hlh media suppression" on storage.objects;
create policy "hlh media suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_admin());
