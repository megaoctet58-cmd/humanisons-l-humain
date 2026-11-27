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
--  • Un contributeur peut aussi créer un compte (facultatif) : il retrouve alors
--    ses contributions, brouillons, favoris et réactions sur tous ses appareils.
--    Chaque compte ne lit et n'écrit que ses propres données.
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

-- Comptes contributeurs (facultatifs) : lien entre une contribution et son compte.
alter table public.post_private add column if not exists owner_user_id uuid references auth.users (id) on delete set null;
create index if not exists post_private_owner_idx on public.post_private (owner_user_id);

-- Données personnelles d'un compte : pseudonyme, favoris, réactions (jamais publiques).
create table if not exists public.user_data (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  pseudonym text check (char_length(pseudonym) <= 60),
  favorites jsonb not null default '[]'::jsonb check (octet_length(favorites::text) < 50000),
  reactions jsonb not null default '{}'::jsonb check (octet_length(reactions::text) < 100000),
  updated_at timestamptz not null default now()
);

-- Brouillons d'un compte (visibles par lui seul, sur tous ses appareils).
create table if not exists public.drafts (
  id text primary key check (char_length(id) between 3 and 80),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (octet_length(data::text) < 300000),
  updated_at timestamptz not null default now()
);
create index if not exists drafts_user_idx on public.drafts (user_id);

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

-- Département déclaré : code INSEE (01 à 95, 2A, 2B, 971 à 976), « COM » (autre collectivité
-- d'outre-mer) ou « HF » (hors de France).
create or replace function public.hlh_valid_department(p_code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_code ~ '^(0[1-9]|1[0-9]|2[1-9]|[3-8][0-9]|9[0-5]|2A|2B|97[12346]|COM|HF)$', false);
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

-- Fichier d'un brouillon du compte connecté.
create or replace function public.media_in_my_drafts(p_media text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.drafts d
    where d.user_id = auth.uid()
      and (
        d.data -> 'images' @> jsonb_build_array(jsonb_build_object('id', p_media))
        or d.data -> 'audio' ->> 'id' = p_media
        or coalesce(d.data -> 'private' -> 'proofs', '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('id', p_media))
      )
  );
$$;

-- Fichier d'une contribution envoyée par le compte connecté (pour la réécouter sur un autre appareil).
create or replace function public.media_in_my_posts(p_media text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.posts p
    join public.post_private pp on pp.post_id = p.id
    where pp.owner_user_id = auth.uid()
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
  v_uid uuid := auth.uid();
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
  -- Seuls l'e-mail, les justificatifs et le département (facultatif) viennent du contributeur.
  v_priv := jsonb_strip_nulls(jsonb_build_object(
    'email', left(p_private ->> 'email', 320),
    'proofs', p_private -> 'proofs',
    'department', case when public.hlh_valid_department(p_private ->> 'department') then p_private ->> 'department' end));
  v_hash := public.hlh_hash(p_token);

  select * into v_existing from public.posts where id = p_id;
  if not found then
    insert into public.posts (id, status, data) values (p_id, 'en_attente', v_data);
    insert into public.post_private (post_id, data, owner_token_hash, owner_user_id) values (p_id, v_priv, v_hash, v_uid);
    return 'en_attente';
  end if;

  if not exists (
    select 1 from public.post_private
    where post_id = p_id and (owner_token_hash = v_hash or (v_uid is not null and owner_user_id = v_uid))
  ) then
    raise exception 'Cette contribution ne vous appartient pas.';
  end if;
  if v_existing.status not in ('en_attente', 'infos_demandees') then
    raise exception 'Cette contribution ne peut plus être modifiée.';
  end if;
  update public.posts set data = v_data, status = 'en_attente', updated_at = now() where id = p_id;
  -- Les notes et le message de la modération sont conservés.
  update public.post_private set data = (data - 'email' - 'proofs' - 'department') || v_priv where post_id = p_id;
  return 'en_attente';
end;
$$;

-- Suivre ses propres contributions : celles envoyées depuis cet appareil
-- (identifiant + jeton) et, si l'on est connecté, celles de son compte.
drop function if exists public.my_contributions(jsonb);
create function public.my_contributions(p_items jsonb)
returns table (id text, status text, data jsonb, published_at timestamptz, scheduled_at timestamptz, updated_at timestamptz,
               message_to_author text, withdrawal_requested boolean, email text, proofs jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select i ->> 'id' as id, i ->> 'token' as token
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) with ordinality as t (i, n)
    where n <= 200
  )
  select p.id, p.status, p.data, p.published_at, p.scheduled_at, p.updated_at,
         pp.data ->> 'messageToAuthor',
         coalesce((pp.data ->> 'withdrawalRequested')::boolean, false),
         pp.data ->> 'email',
         pp.data -> 'proofs',
         p.created_at
  from public.posts p
  join public.post_private pp on pp.post_id = p.id
  where (auth.uid() is not null and pp.owner_user_id = auth.uid())
     or exists (select 1 from q where q.id = p.id and pp.owner_token_hash = public.hlh_hash(q.token));
$$;

-- Rattacher à son compte les contributions envoyées depuis cet appareil avant la connexion.
create or replace function public.claim_contributions(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;
  update public.post_private pp set owner_user_id = auth.uid()
  from (
    select i ->> 'id' as id, i ->> 'token' as token
    from jsonb_array_elements(case when jsonb_typeof(p_items) = 'array' then p_items else '[]'::jsonb end) with ordinality as t (i, n)
    where n <= 200
  ) q
  where pp.post_id = q.id and pp.owner_user_id is null and pp.owner_token_hash = public.hlh_hash(q.token);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Supprimer son compte (droit à l'effacement) : données du compte et brouillons.
-- Les contributions envoyées restent auprès de la modération, détachées du compte
-- (leur retrait peut être demandé avant).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise.';
  end if;
  if exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Le compte administrateur ne peut pas être supprimé depuis le site.';
  end if;
  delete from auth.users where id = auth.uid();
end;
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
  where post_id = p_id
    and (owner_token_hash = public.hlh_hash(p_token) or (auth.uid() is not null and owner_user_id = auth.uid()));
  if not found then
    raise exception 'Contribution introuvable.';
  end if;
end;
$$;

-- Carte : nombre de publications PUBLIQUES par département. Le département de chaque
-- publication reste privé : au-dessous de 3 publications, ni le nombre exact ni la liste
-- ne sont donnés (seulement « moins de 3 »), pour que personne ne puisse être reconnu.
drop function if exists public.department_map();
create function public.department_map()
returns table (department text, n integer, ids text[])
language sql
stable
security definer
set search_path = ''
as $$
  select s.dep,
         case when count(*) >= 3 then count(*)::integer end,
         case when count(*) >= 3 then array_agg(s.id order by s.id) end
  from (
    select pp.data ->> 'department' as dep, p.id
    from public.posts p
    join public.post_private pp on pp.post_id = p.id
    where public.hlh_is_public(p.status, p.scheduled_at)
      and public.hlh_valid_department(pp.data ->> 'department')
  ) s
  group by s.dep;
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
alter table public.user_data enable row level security;
alter table public.drafts enable row level security;

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

-- user_data, drafts : chaque compte ne voit et ne modifie que les siens.
drop policy if exists "donnees du compte" on public.user_data;
create policy "donnees du compte" on public.user_data for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "brouillons du compte" on public.drafts;
create policy "brouillons du compte" on public.drafts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Droits de base (la RLS ci-dessus filtre ensuite ligne par ligne).
revoke all on public.admins, public.posts, public.post_private, public.reports, public.app_kv, public.user_data, public.drafts from anon;
grant select on public.posts, public.app_kv to anon;
grant select, insert, update, delete on public.posts, public.post_private, public.reports, public.app_kv to authenticated;
grant select on public.admins to authenticated;
grant select, insert, update, delete on public.user_data, public.drafts to authenticated;

grant execute on function public.is_admin(), public.hlh_is_public(text, timestamptz), public.hlh_hash(text),
  public.media_is_public(text), public.media_upload_allowed(text),
  public.submit_contribution(text, jsonb, jsonb, text), public.my_contributions(jsonb),
  public.request_withdrawal(text, text, text), public.report_post(text, text, text),
  public.media_in_my_drafts(text), public.media_in_my_posts(text),
  public.hlh_valid_department(text), public.department_map()
  to anon, authenticated;
grant execute on function public.claim_contributions(jsonb), public.delete_my_account() to authenticated;
revoke execute on function public.claim_contributions(jsonb), public.delete_my_account() from public, anon;

-- ---------------------------------------------------------------------
-- 5. Fichiers : espace privé « media » (50 Mo max par fichier)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "hlh media lecture" on storage.objects;
create policy "hlh media lecture" on storage.objects for select to anon, authenticated
  using (bucket_id = 'media' and (public.is_admin() or public.media_is_public(name) or public.media_in_my_drafts(name) or public.media_in_my_posts(name)));

drop policy if exists "hlh media envoi" on storage.objects;
create policy "hlh media envoi" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'media' and (public.is_admin() or public.media_upload_allowed(name) or public.media_in_my_drafts(name)));

drop policy if exists "hlh media modification" on storage.objects;
create policy "hlh media modification" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_admin()) with check (bucket_id = 'media' and public.is_admin());

drop policy if exists "hlh media suppression" on storage.objects;
create policy "hlh media suppression" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (public.is_admin() or public.media_in_my_drafts(name)));
