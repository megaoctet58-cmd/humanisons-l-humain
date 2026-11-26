-- =====================================================================
-- Désigner l'administrateur (à faire UNE fois, après avoir créé votre
-- utilisateur dans « Authentication » → « Users »).
-- Remplacez l'adresse ci-dessous par la vôtre, puis « Run ».
-- =====================================================================
insert into public.admins (user_id)
select id from auth.users where email = 'VOTRE-ADRESSE@exemple.fr'
on conflict do nothing;

-- Vérification : doit afficher votre adresse.
select u.email from public.admins a join auth.users u on u.id = a.user_id;
