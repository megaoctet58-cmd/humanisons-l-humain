# Brancher la base partagée (Supabase) — guide pas à pas

But : qu'un témoignage validé sur un téléphone apparaisse sur **tous** les appareils,
et que l'administration soit protégée par un vrai mot de passe.

Durée : environ 15 minutes. Coût : 0 € (offre gratuite de Supabase, sans carte bancaire).
Limites de l'offre gratuite : 500 Mo de base de données, **1 Go de fichiers** (voix, images),
et le projet **se met en veille après 7 jours sans aucune visite**. Il se réveille en un clic
(voir « Si le site affiche une erreur » en bas).

> Vous n'avez rien à installer. Tout se fait dans votre navigateur, sur ordinateur de préférence.

---

## Étape 1 — Créer le compte

1. Ouvrez **https://supabase.com** et cliquez sur **Start your project**.
2. Choisissez **Continue with GitHub** (le plus simple : vous avez déjà un compte GitHub),
   puis acceptez.
3. Si Supabase vous demande de créer une « organization » :
   - *Name* : `Humanisons`
   - *Type* : **Personal**
   - *Plan* : **Free - $0/month**
   - cliquez sur **Create organization**.

## Étape 2 — Créer le projet

1. Cliquez sur **New project**.
2. Remplissez :
   - *Project name* : `humanisons-l-humain`
   - *Database Password* : cliquez sur **Generate a password**, puis copiez-le dans un endroit sûr
     (votre gestionnaire de mots de passe). Vous n'en aurez normalement pas besoin, et
     **ne me l'envoyez pas**.
   - *Region* : **West EU (Paris)** (ou la plus proche de la France proposée).
   - Laissez les autres options telles quelles.
3. Cliquez sur **Create new project**, puis patientez 1 à 2 minutes : la page se met à jour toute seule.

## Étape 3 — Installer les tables et les règles de sécurité

1. Ouvrez ce fichier dans un autre onglet :
   https://github.com/megaoctet58-cmd/humanisons-l-humain/blob/main/supabase/schema.sql
   puis cliquez sur l'icône **Copy raw file** (deux petits carrés, en haut à droite du code).
2. Dans Supabase, menu de gauche : **SQL Editor** (icône `>_`).
3. Cliquez sur **+ New query** (ou « New SQL snippet »).
4. Collez (Ctrl+V) tout le texte, puis cliquez sur **Run** (en bas à droite).
   Si Supabase affiche un avertissement (« destructive operation »), cliquez sur
   **Run this query** : le script ne supprime aucune donnée.
5. Vous devez voir **Success. No rows returned**.

## Étape 4 — Créer votre compte administrateur

1. Menu de gauche : **Authentication** → **Users**.
2. Cliquez sur **Add user** → **Create new user**.
3. Saisissez votre adresse e-mail et un **mot de passe solide** (c'est celui que vous taperez pour
   entrer dans l'administration du site). Cochez **Auto Confirm User**.
4. Cliquez sur **Create user**.

## Étape 5 — Vous désigner comme administrateur

1. Retournez dans **SQL Editor** → **+ New query**.
2. Collez ces lignes en remplaçant l'adresse par **la vôtre** (celle de l'étape 4) :

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'VOTRE-ADRESSE@exemple.fr'
   on conflict do nothing;

   select u.email from public.admins a join auth.users u on u.id = a.user_id;
   ```
3. Cliquez sur **Run**. Votre adresse doit s'afficher en bas. Si rien ne s'affiche,
   vérifiez qu'elle est écrite exactement comme à l'étape 4.

## Étape 6 — Fermer les inscriptions

Personne d'autre que vous ne doit pouvoir créer de compte.

1. **Authentication** → **Sign In / Providers** (parfois nommé « Providers » ou « Settings »).
2. Désactivez **Allow new users to sign up**, puis **Save**.

(Même si quelqu'un réussissait à créer un compte, il n'aurait aucun droit : seuls les comptes
inscrits à l'étape 5 administrent. C'est une sécurité de plus.)

## Étape 7 — M'envoyer les deux informations publiques

1. Cliquez sur le bouton **Connect** en haut de la page du projet (ou **Project Settings** → **API Keys**).
2. Copiez et envoyez-moi dans le fil :
   - **Project URL** : elle ressemble à `https://abcdefghijkl.supabase.co`
   - la clé **publishable** (commence par `sb_publishable_…`) ou, à défaut, la clé **anon public**
     (longue suite commençant par `eyJ…`).

Ces deux informations sont **faites pour être publiques** : elles seront visibles dans le site,
la sécurité est assurée par les règles installées à l'étape 3.

> ⚠ **Ne m'envoyez jamais** la clé **secret** (`sb_secret_…`) ni la clé **service_role**,
> ni le mot de passe de la base de données. Ces éléments-là donnent tous les droits.

## Ensuite (c'est moi qui le fais)

Je branche le site sur la base, je vérifie, et le site en ligne se met à jour tout seul.
À partir de ce moment :

- les publications validées sont visibles sur tous les appareils ;
- **l'administration demande votre e-mail et votre mot de passe** (menu ☰ → Administration) ;
- les exemples fictifs et les publications enregistrées dans un téléphone avec l'ancienne
  version ne s'affichent plus d'office.

**Pour récupérer le témoignage validé sur votre téléphone** : sur ce même téléphone, ouvrez le site,
menu ☰ → **Administration**, connectez-vous, onglet **Paramètres et données**, puis bouton
**Envoyer vers la base partagée**. Il apparaîtra alors partout.

## Si le site affiche une erreur « Les publications n'ont pas pu être chargées »

Le projet est probablement en veille (7 jours sans visite). Connectez-vous sur supabase.com,
ouvrez le projet et cliquez sur **Restore project**. Après une ou deux minutes, le site refonctionne.
Aucune donnée n'est perdue.

## Sauvegardes

Pensez à faire de temps en temps : Administration → Paramètres et données → **Exporter les données**.
Le fichier obtenu contient tout (y compris les voix et les données privées) : gardez-le en lieu sûr.

---

## Mise à jour V0.3 : comptes contributeurs (à faire une fois)

1. **Relancer le script de sécurité** : comme à l'étape 3, copiez
   https://github.com/megaoctet58-cmd/humanisons-l-humain/blob/main/supabase/schema.sql
   dans **SQL Editor** → **+ New query** → **Run** (confirmez l'avertissement s'il apparaît).
   Rien n'est effacé : le script ajoute les tables des comptes et met à jour les règles.
2. **Ouvrir les inscriptions** : **Authentication** → **Sign In / Providers** →
   activez **Allow new users to sign up** → **Save**.
   (Sans danger : un compte contributeur n'a aucun droit d'administration.)
3. **Désactiver la confirmation par e-mail** : même page, section **Email** →
   désactivez **Confirm email** → **Save**.
   Pourquoi : l'envoi d'e-mails intégré à l'offre gratuite de Supabase ne fonctionne
   que pour les membres de votre équipe Supabase. Sans ce réglage, personne d'autre ne pourrait
   finir son inscription. On pourra brancher plus tard un service d'e-mails gratuit (par exemple
   Brevo, 300 e-mails par jour) pour réactiver la confirmation et le « mot de passe oublié ».
