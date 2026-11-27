-- Tests des règles d'accès. Chaque vérification lève une erreur si elle échoue.
\set ON_ERROR_STOP on
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'admin@test.fr'), ('22222222-2222-2222-2222-222222222222', 'intrus@test.fr');
insert into public.admins (user_id) values ('11111111-1111-1111-1111-111111111111');

create function pg_temp.check(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'ÉCHEC : %', msg; end if; raise notice 'ok : %', msg; end $$;
grant execute on function pg_temp.check(boolean, text) to anon, authenticated;

-- ===== Visiteur anonyme dépose une contribution =====
set role anon;
select pg_temp.check(public.submit_contribution('p_test1',
  '{"title":"Mon témoignage","text":"Bonjour","byFounder":true,"demo":true,"verification":"sources_verifiees","images":[{"id":"m_img1"}],"audio":{"id":"m_voix1","publishVoice":false}}',
  '{"email":"secret@test.fr","proofs":[{"id":"m_proof1"}],"moderationNotes":"triche"}',
  'jeton-secret-tres-long-0123456789') = 'en_attente', 'anon peut déposer');
select pg_temp.check((select count(*) from public.posts) = 0, 'anon ne voit pas la contribution en attente');
do $$ begin
  perform * from public.post_private; raise exception 'ÉCHEC : anon lit post_private';
exception when insufficient_privilege then raise notice 'ok : anon ne peut pas lire post_private'; end $$;
do $$ begin
  perform * from public.reports; raise exception 'ÉCHEC : anon lit reports';
exception when insufficient_privilege then raise notice 'ok : anon ne peut pas lire reports'; end $$;
do $$ begin
  insert into public.posts (id, status, data) values ('p_pirate', 'publie', '{}'); raise exception 'ÉCHEC : anon insère une publication';
exception when insufficient_privilege then raise notice 'ok : anon ne peut pas publier directement'; end $$;
-- suivi par jeton
select pg_temp.check((select count(*) from public.my_contributions('[{"id":"p_test1","token":"jeton-secret-tres-long-0123456789"}]')) = 1, 'le contributeur suit sa contribution avec son jeton');
select pg_temp.check((select count(*) from public.my_contributions('[{"id":"p_test1","token":"mauvais-jeton-mauvais-jeton-xx"}]')) = 0, 'un mauvais jeton ne révèle rien');
-- impossible de réécrire sans jeton / hors infos_demandees
do $$ begin
  perform public.submit_contribution('p_test1', '{"title":"pirate"}', '{}', 'autre-jeton-autre-jeton-autre-123');
  raise exception 'ÉCHEC : réécriture avec un autre jeton';
exception when raise_exception then
  if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'ok : réécriture refusée (%)', sqlerrm; end $$;
select pg_temp.check(public.submit_contribution('p_test1',
  '{"title":"Mon témoignage","text":"Bonjour (corrigé)","images":[{"id":"m_img1"}],"audio":{"id":"m_voix1","publishVoice":false}}',
  '{"email":"secret@test.fr","proofs":[{"id":"m_proof1"}]}',
  'jeton-secret-tres-long-0123456789') = 'en_attente', 'le contributeur corrige tant que c''est en attente');
-- fichiers : envoi autorisé seulement pour les fichiers déclarés
insert into storage.objects (bucket_id, name) values ('media', 'm_img1'), ('media', 'm_voix1'), ('media', 'm_proof1');
select pg_temp.check(true, 'anon envoie les fichiers déclarés');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('media', 'm_inconnu'); raise exception 'ÉCHEC : fichier non déclaré accepté';
exception when insufficient_privilege then raise notice 'ok : fichier non déclaré refusé'; end $$;
select pg_temp.check((select count(*) from storage.objects) = 0, 'anon ne lit aucun fichier d''une contribution en attente');
do $$ begin
  perform public.report_post('p_test1', 'x', 'y'); raise exception 'ÉCHEC : signalement d''une contribution non publiée';
exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'ok : signalement refusé sur non publié'; end $$;
reset role; reset request.jwt.claim.sub;

-- Le serveur a bien neutralisé les champs réservés
select pg_temp.check((select data->>'byFounder' = 'false' and data->>'demo' = 'false' and data->>'verification' = 'non_verifie' from public.posts where id = 'p_test1'), 'champs réservés neutralisés');
select pg_temp.check((select not (data ? 'moderationNotes') and data->>'email' = 'secret@test.fr' from public.post_private where post_id = 'p_test1'), 'seuls e-mail et justificatifs gardés');
select pg_temp.check((select owner_token_hash <> 'jeton-secret-tres-long-0123456789' from public.post_private where post_id = 'p_test1'), 'jeton stocké sous forme d''empreinte');

-- ===== Utilisateur connecté mais PAS admin =====
set role authenticated;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select pg_temp.check(not public.is_admin(), 'intrus non admin');
select pg_temp.check((select count(*) from public.posts) = 0, 'intrus ne voit pas les contributions en attente');
select pg_temp.check((select count(*) from public.post_private) = 0, 'intrus ne voit pas les données privées');
update public.posts set status = 'publie' where id = 'p_test1';
select pg_temp.check(true, 'tentative de publication par l''intrus (sans effet attendu)');
do $$ begin
  insert into public.admins (user_id) values ('22222222-2222-2222-2222-222222222222'); raise exception 'ÉCHEC : intrus se nomme admin';
exception when insufficient_privilege then raise notice 'ok : intrus ne peut pas se nommer admin'; end $$;
do $$ begin
  insert into public.app_kv (key, value) values ('settings', '{}'); raise exception 'ÉCHEC : intrus modifie les paramètres';
exception when insufficient_privilege then raise notice 'ok : intrus ne modifie pas les paramètres'; end $$;
reset role; reset request.jwt.claim.sub;
select pg_temp.check((select status from public.posts where id = 'p_test1') = 'en_attente', 'la publication par l''intrus n''a eu aucun effet');

-- ===== Admin =====
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select pg_temp.check(public.is_admin(), 'admin reconnu');
select pg_temp.check((select count(*) from public.posts) = 1, 'admin voit la contribution en attente');
select pg_temp.check((select data->>'email' from public.post_private where post_id = 'p_test1') = 'secret@test.fr', 'admin voit l''e-mail');
select pg_temp.check((select count(*) from storage.objects) = 3, 'admin voit les fichiers');
update public.post_private set data = data || '{"messageToAuthor":"Pouvez-vous préciser ?"}' where post_id = 'p_test1';
update public.posts set status = 'infos_demandees', updated_at = now() where id = 'p_test1';
insert into public.app_kv (key, value) values ('settings', '{"founderName":"Jérémy"}') on conflict (key) do update set value = excluded.value;
reset role; reset request.jwt.claim.sub;

-- ===== Contributeur complète sa contribution =====
set role anon;
select pg_temp.check((select message_to_author from public.my_contributions('[{"id":"p_test1","token":"jeton-secret-tres-long-0123456789"}]')) = 'Pouvez-vous préciser ?', 'le contributeur lit le message de la modération');
select pg_temp.check(public.submit_contribution('p_test1', '{"title":"Mon témoignage complété","images":[{"id":"m_img1"}],"audio":{"id":"m_voix1","publishVoice":false}}', '{"email":"secret@test.fr","proofs":[{"id":"m_proof1"}]}', 'jeton-secret-tres-long-0123456789') = 'en_attente', 'le contributeur complète');
select public.request_withdrawal('p_test1', 'jeton-secret-tres-long-0123456789', 'Je préfère retirer');
select pg_temp.check(true, 'demande de retrait');
select pg_temp.check((select settings from (select value->>'founderName' as settings from public.app_kv where key='settings') s) = 'Jérémy', 'paramètres lisibles publiquement');
reset role; reset request.jwt.claim.sub;
select pg_temp.check((select data->>'messageToAuthor' = 'Pouvez-vous préciser ?' and data->>'withdrawalRequested' = 'true' from public.post_private where post_id = 'p_test1'), 'message de modération conservé + retrait enregistré');
update public.posts set status = 'valide' where id = 'p_test1';
set role anon;
do $$ begin
  perform public.submit_contribution('p_test1', '{"title":"modif"}', '{}', 'jeton-secret-tres-long-0123456789');
  raise exception 'ÉCHEC : modification après validation';
exception when raise_exception then
  if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'ok : modification refusée après validation (%)', sqlerrm; end $$;
reset role; reset request.jwt.claim.sub;

-- ===== Publication : ce que voit le public =====
update public.posts set status = 'publie', published_at = now() where id = 'p_test1';
insert into public.posts (id, status, data, scheduled_at) values ('p_futur', 'programme', '{"title":"Plus tard"}', now() + interval '1 day'), ('p_passe', 'programme', '{"title":"Déjà"}', now() - interval '1 minute');
set role anon;
select pg_temp.check((select count(*) from public.posts) = 2, 'public : publiée + programmée échue visibles, programmée future cachée');
select pg_temp.check((select string_agg(name, ',' order by name) from storage.objects) = 'm_img1', 'public : image lisible, voix non autorisée et justificatif cachés');
select public.report_post('p_test1', 'Contenu inexact', 'détail');
select pg_temp.check(true, 'signalement d''une publication publique');
reset role; reset request.jwt.claim.sub;
update public.posts set data = jsonb_set(data, '{audio,publishVoice}', 'true') where id = 'p_test1';
set role anon;
select pg_temp.check((select string_agg(name, ',' order by name) from storage.objects) = 'm_img1,m_voix1', 'public : voix lisible quand la diffusion est autorisée');
do $$ begin
  delete from storage.objects where name = 'm_img1';
  if (select count(*) from storage.objects where name = 'm_img1') = 0 then raise exception 'ÉCHEC : anon supprime un fichier'; end if;
  raise notice 'ok : anon ne supprime pas de fichier';
end $$;
reset role; reset request.jwt.claim.sub;
select pg_temp.check((select count(*) from public.reports) = 1, 'signalement enregistré');

-- ===== Comptes contributeurs =====
insert into auth.users (id, email) values ('33333333-3333-3333-3333-333333333333', 'alice@test.fr'), ('44444444-4444-4444-4444-444444444444', 'bob@test.fr');
-- Alice, sans compte, envoie depuis son téléphone, puis se connecte et rattache sa contribution
set role anon;
select public.submit_contribution('p_alice_tel', '{"title":"Depuis le téléphone"}', '{"email":"alice@test.fr"}', 'jeton-alice-telephone-0123456789');
do $$ begin
  perform public.claim_contributions('[]'); raise exception 'ÉCHEC : claim anonyme';
exception when insufficient_privilege then raise notice 'ok : rattachement impossible sans compte'; end $$;
reset role; reset request.jwt.claim.sub;
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.check(public.claim_contributions('[{"id":"p_alice_tel","token":"jeton-alice-telephone-0123456789"}]') = 1, 'Alice rattache sa contribution à son compte');
select pg_temp.check(public.submit_contribution('p_alice_pc', '{"title":"Depuis le compte","audio":{"id":"m_alice_voix","publishVoice":false}}', '{"proofs":[{"id":"m_alice_preuve"}]}', 'autre-jeton-alice-ordinateur-0123') = 'en_attente', 'Alice connectée envoie une contribution');
-- Brouillon synchronisé + fichiers
insert into public.drafts (id, data) values ('d_alice', '{"title":"Brouillon","images":[{"id":"m_alice_brouillon"}],"private":{"proofs":[{"id":"m_alice_brouillon_preuve"}]}}');
insert into public.user_data (pseudonym, favorites) values ('Alice', '["p_test1"]');
insert into storage.objects (bucket_id, name) values ('media', 'm_alice_brouillon'), ('media', 'm_alice_brouillon_preuve'), ('media', 'm_alice_voix');
select pg_temp.check(true, 'Alice envoie les fichiers de son brouillon et de sa contribution');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('media', 'm_pas_a_alice'); raise exception 'ÉCHEC : fichier non déclaré accepté pour Alice';
exception when insufficient_privilege then raise notice 'ok : fichier non déclaré refusé (compte)'; end $$;
reset role; reset request.jwt.claim.sub;
-- Sur un autre appareil, Alice (connectée, sans jeton) retrouve tout
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select pg_temp.check((select count(*) from public.my_contributions('[]')) = 2, 'Alice retrouve ses 2 contributions sans jeton');
select pg_temp.check((select count(*) from public.drafts) = 1 and (select pseudonym from public.user_data) = 'Alice', 'Alice retrouve brouillon et pseudonyme');
select pg_temp.check((select string_agg(name, ',' order by name) from storage.objects where name like 'm_alice%') = 'm_alice_brouillon,m_alice_brouillon_preuve,m_alice_voix', 'Alice peut réécouter sa voix non publiée et ses fichiers');
select public.request_withdrawal('p_alice_pc', '', 'Je retire');
select pg_temp.check(true, 'Alice demande un retrait depuis son compte, sans jeton');
reset role; reset request.jwt.claim.sub;
-- Bob ne voit rien d'Alice
set role authenticated; set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select pg_temp.check((select count(*) from public.my_contributions('[]')) = 0, 'Bob ne voit pas les contributions d''Alice');
select pg_temp.check((select count(*) from public.drafts) = 0 and (select count(*) from public.user_data) = 0, 'Bob ne voit ni brouillons ni favoris d''Alice');
select pg_temp.check((select count(*) from storage.objects where name like 'm_alice%') = 0, 'Bob ne lit aucun fichier d''Alice');
update public.drafts set data = '{"title":"piraté"}' where id = 'd_alice';
delete from storage.objects where name = 'm_alice_brouillon';
do $$ begin
  perform public.submit_contribution('p_alice_pc', '{"title":"piraté"}', '{}', 'jeton-de-bob-jeton-de-bob-0123456');
  raise exception 'ÉCHEC : Bob modifie la contribution d''Alice';
exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'ok : Bob ne peut pas modifier la contribution d''Alice'; end $$;
do $$ begin
  perform public.request_withdrawal('p_alice_tel', 'jeton-de-bob-jeton-de-bob-0123456', 'x'); raise exception 'ÉCHEC : retrait par Bob';
exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'ok : Bob ne peut pas demander le retrait'; end $$;
do $$ begin
  insert into public.drafts (id, user_id, data) values ('d_bob_pirate', '33333333-3333-3333-3333-333333333333', '{}'); raise exception 'ÉCHEC : Bob écrit chez Alice';
exception when insufficient_privilege then raise notice 'ok : Bob ne peut pas écrire un brouillon au nom d''Alice'; end $$;
reset role; reset request.jwt.claim.sub;
select pg_temp.check((select data->>'title' from public.drafts where id = 'd_alice') = 'Brouillon' and (select count(*) from storage.objects where name = 'm_alice_brouillon') = 1, 'brouillon et fichier d''Alice intacts');
-- Le public ne voit toujours rien
set role anon;
select pg_temp.check((select count(*) from storage.objects where name like 'm_alice%') = 0, 'public : aucun fichier d''Alice');
do $$ begin
  perform * from public.drafts; raise exception 'ÉCHEC : anon lit les brouillons';
exception when insufficient_privilege then raise notice 'ok : anon ne lit pas les brouillons'; end $$;
reset role;
-- Alice supprime son compte
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select public.delete_my_account();
reset role; reset request.jwt.claim.sub;
select pg_temp.check((select count(*) from auth.users where email = 'alice@test.fr') = 0 and (select count(*) from public.drafts where id = 'd_alice') = 0 and (select count(*) from public.user_data) = 0, 'suppression du compte : compte, brouillons et favoris effacés');
select pg_temp.check((select owner_user_id is null from public.post_private where post_id = 'p_alice_pc'), 'contribution détachée du compte supprimé');
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
do $$ begin
  perform public.delete_my_account(); raise exception 'ÉCHEC : admin supprimé';
exception when raise_exception then if sqlerrm like 'ÉCHEC%' then raise; end if; raise notice 'ok : le compte admin ne se supprime pas par erreur'; end $$;
reset role; reset request.jwt.claim.sub;

-- ---------------------------------------------------------------------
-- Carte par département
-- ---------------------------------------------------------------------
reset role; reset request.jwt.claim.sub;
set role anon;
select public.submit_contribution('p_dep_1', '{"title":"Nièvre 1"}', '{"department":"58"}', 'jeton-carte-jeton-carte-000000001');
select public.submit_contribution('p_dep_2', '{"title":"Nièvre 2"}', '{"department":"58"}', 'jeton-carte-jeton-carte-000000002');
select public.submit_contribution('p_dep_3', '{"title":"Nièvre 3"}', '{"department":"58"}', 'jeton-carte-jeton-carte-000000003');
select public.submit_contribution('p_dep_4', '{"title":"Corse"}', '{"department":"2A"}', 'jeton-carte-jeton-carte-000000004');
select public.submit_contribution('p_dep_5', '{"title":"Faux"}', '{"department":"<script>"}', 'jeton-carte-jeton-carte-000000005');
select public.submit_contribution('p_dep_6', '{"title":"Nièvre attente"}', '{"department":"58"}', 'jeton-carte-jeton-carte-000000006');
reset role;
select pg_temp.check((select data->>'department' from public.post_private where post_id = 'p_dep_1') = '58', 'département enregistré dans les données privées');
select pg_temp.check((select data ? 'department' from public.posts where id = 'p_dep_1') = false, 'département absent des données publiques');
select pg_temp.check((select data->>'department' from public.post_private where post_id = 'p_dep_5') is null, 'département invalide ignoré');
update public.posts set status = 'publie', published_at = now() where id in ('p_dep_1', 'p_dep_2', 'p_dep_4', 'p_dep_5');
set role anon;
select pg_temp.check((select count(*) from public.department_map() where department = '58') = 1 and (select n is null and ids is null from public.department_map() where department = '58'), 'carte : 2 publiés → « moins de 3 », sans liste');
reset role;
update public.posts set status = 'publie', published_at = now() where id = 'p_dep_3';
set role anon;
select pg_temp.check((select n = 3 and ids = array['p_dep_1','p_dep_2','p_dep_3'] from public.department_map() where department = '58'), 'carte : 3 publiés → nombre et liste (contribution en attente non comptée)');
select pg_temp.check((select n is null from public.department_map() where department = '2A'), 'carte : 1 publié en Corse-du-Sud → « moins de 3 »');
do $$ begin
  perform * from public.post_private; raise exception 'ÉCHEC : anon lit post_private';
exception when insufficient_privilege then raise notice 'ok : la carte ne donne pas accès aux données privées'; end $$;
reset role;
-- Correction par le contributeur : le département suit la nouvelle version.
update public.posts set status = 'en_attente' where id = 'p_dep_6';
set role anon;
select public.submit_contribution('p_dep_6', '{"title":"Nièvre attente"}', '{}', 'jeton-carte-jeton-carte-000000006');
reset role;
select pg_temp.check((select data->>'department' from public.post_private where post_id = 'p_dep_6') is null, 'département retiré quand le contributeur le retire');
\echo TOUS LES TESTS RLS SONT PASSÉS
