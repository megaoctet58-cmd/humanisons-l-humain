# Architecture et suite du projet

## Choix techniques de la V0.1 (et pourquoi)

- **React + TypeScript + Vite** plutôt que Next.js pour ce prototype : application 100 % statique,
  sans serveur, qui s'héberge gratuitement partout et se teste en un fichier. Le code (composants,
  modèles, services) se transposera tel quel dans Next.js si le rendu serveur devient utile
  (référencement des publications publiques, aperçus de liens).
- **IndexedDB** pour publications et fichiers (Blob audio/images), **localStorage** pour les préférences.
- **Routeur par hash** (`#/publication/<id>`) : fonctionne sur tout hébergement statique.
- **Aucune dépendance d'exécution** hormis React. Pas d'analytics, pas de CDN externe, polices système.
- L'audio enregistré est conservé **tel quel** (webm/opus ou mp4 selon le navigateur) : pas de
  ré-encodage, la voix et l'intonation restent originales. Durée et onde sont calculées à l'enregistrement.

## Base partagée (V0.2) — comment c'est construit

- **Supabase** (offre gratuite) : PostgreSQL + stockage de fichiers + connexion. Choisi parce qu'il
  fournit les trois sans serveur à écrire, avec des règles d'accès dans la base (RLS) : le site reste
  100 % statique sur GitHub Pages. Seule la clé publique (anon / publishable) est dans le code.
- `src/config.ts` vide → mode local inchangé (V0.1). Rempli → `repository.ts` utilise `remote.ts`.
- Tables (`supabase/schema.sql`) :
  - `posts` : contenu public de chaque publication (`data` jsonb) + `status`, dates. Lecture publique
    limitée aux statuts `publie` et `programme` échu.
  - `post_private` : e-mail, justificatifs, notes de modération, message à l'auteur, retrait,
    pseudonyme d'un auteur anonyme, empreinte du jeton du contributeur. **Admin uniquement.**
  - `reports`, `app_kv` (catégories, paramètres), `admins` (qui administre).
- Contributeurs sans compte : fonctions `submit_contribution`, `my_contributions`,
  `request_withdrawal`, `report_post` (security definer, contrôles stricts). Le contributeur garde
  un jeton secret dans son navigateur ; la base n'en garde que l'empreinte sha256.
- Fichiers : seau privé `media`. Lecture publique seulement des images et des voix autorisées des
  publications visibles. Envoi anonyme seulement des fichiers déclarés par une contribution en attente.
- Restent sur l'appareil : brouillons, favoris, réactions, copie des contributions envoyées.
- Rafraîchissement : relecture au retour sur l'onglet, en changeant de page (au plus toutes les 3 s)
  et chaque minute.
- Transfert des données V0.1 : Administration → Paramètres → « Envoyer vers la base partagée ».

## Suite possible

1. Comptes contributeurs (Supabase Auth, lien magique) et rôle `moderateur`.
2. Pagination du fil côté serveur quand il dépassera quelques centaines de publications.
3. Transcription : implémenter `TranscriptionEngine` (`src/services/transcription.ts`) avec
   whisper.cpp en WebAssembly (gratuit, local au navigateur).
4. Avant ouverture publique : anti-spam renforcé (captcha), CGU, confidentialité, mentions légales, RGPD.
