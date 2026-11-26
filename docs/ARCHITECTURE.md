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

## Brancher un vrai serveur (phase 4)

1. Créer les tables (Supabase/PostgreSQL) d'après `src/models/types.ts`
   (`posts`, `media`, `reports`, `categories`, `reactions`, `favorites`), en séparant
   les champs `private` dans une table protégée (e-mail, justificatifs, notes de modération).
2. Réécrire `src/services/repository.ts` avec les mêmes fonctions (listPosts, savePost, saveMedia…).
   Les fichiers vont dans Supabase Storage (seau privé pour les contributions non publiées).
3. Remplacer `DataProvider` par des requêtes paginées côté serveur pour le fil public.
4. Authentification (Supabase Auth) + rôles `fondateur`, `moderateur`, `contributeur` ;
   règles RLS : un visiteur ne lit que les publications `publie`.
5. Transcription : implémenter `TranscriptionEngine` (`src/services/transcription.ts`) avec
   Whisper auto-hébergé ou whisper.cpp en WebAssembly (gratuit, local au navigateur).
6. Avant ouverture publique : anti-spam, limites de débit, CGU, confidentialité, mentions légales, RGPD.
