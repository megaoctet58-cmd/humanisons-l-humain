# Tests de la base partagée

Deux niveaux, sans compte Supabase ni Internet (un PostgreSQL local suffit) :

1. **`rls-test.sql`** : vérifie les règles d'accès de `../schema.sql` directement dans PostgreSQL
   (visiteur anonyme, compte non admin, admin, contributeur avec ou sans jeton, fichiers).
2. **`../../tests/partage.e2e.mjs`** : trois navigateurs = trois appareils (contributeur, visiteur, admin)
   contre `fake-supabase.mjs`, une imitation des routes Supabase qui exécute chaque requête dans
   PostgreSQL sous le rôle `anon` ou `authenticated` (donc avec les vraies règles RLS).

`stub-supabase.sql` recrée le minimum de l'environnement Supabase (rôles, `auth.uid()`, `storage.objects`).

```bash
# PostgreSQL local (exemple) : PGHOST=/var/tmp/hlhpg PGPORT=54329 PGUSER=postgres
createdb hlh && psql -d hlh -f supabase/tests/stub-supabase.sql -f supabase/schema.sql -f supabase/tests/rls-test.sql

# Test plusieurs appareils
createdb hlh_e2e && psql -d hlh_e2e -f supabase/tests/stub-supabase.sql -f supabase/schema.sql \
  -c "insert into auth.users(email) values ('admin@test.fr'),('intrus@test.fr')" \
  -c "insert into public.admins(user_id) select id from auth.users where email='admin@test.fr'"
PGDATABASE=hlh_e2e node supabase/tests/fake-supabase.mjs &
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=cle-anon-de-test npx vite build --outDir dist-remote
npx vite preview --outDir dist-remote --port 4174 &
npm run test:partage
```
