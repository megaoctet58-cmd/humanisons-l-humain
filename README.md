# HUMANISONS L'HUMAIN (HLH) — Prototype V0.2

> Un réseau humain plutôt qu'un réseau social.
> Observer · Écouter · Questionner · Humaniser.

Prototype **local** et fonctionnel : fil chronologique, témoignages écrits et vocaux (vrai micro),
modération locale, réactions empathiques, favoris, brouillons, thèmes clair/sombre.
Aucun service payant, aucun traceur.

**Deux modes de fonctionnement :**

- **Local** (par défaut, comme la V0.1) : tout reste dans le navigateur de chaque appareil (IndexedDB).
- **Base partagée** (V0.2, facultatif) : dès que `src/config.ts` reçoit l'adresse et la clé publique
  d'un projet Supabase gratuit, publications, contributions et fichiers sont partagés entre tous les
  appareils, et l'administration est protégée par e-mail + mot de passe.
  Mise en place pas à pas : [`docs/MISE-EN-PLACE-SUPABASE.md`](docs/MISE-EN-PLACE-SUPABASE.md).
  Sécurité (RLS) : [`supabase/schema.sql`](supabase/schema.sql).

## Installer et lancer

Prérequis : [Node.js](https://nodejs.org) 18 ou plus récent.

```bash
npm install
npm run dev        # http://localhost:5173  (développement)
```

Version optimisée :

```bash
npm run build      # produit le dossier dist/
npm run preview    # http://localhost:4173
```

Fichier unique autonome (pratique pour tester sans serveur) :

```bash
npm run build:single   # produit dist-single/index.html
```

Ce fichier s'ouvre par double-clic dans **Chrome ou Edge** (micro et stockage fonctionnent en `file://`).
Sous Firefox/Safari, préférez `npm run preview`.

### Le micro exige un contexte sécurisé
L'enregistrement fonctionne sur `http://localhost` ou en `https://`. Pour tester sur un téléphone du même
réseau Wi-Fi, `npm run dev` affiche une adresse `http://192.168.x.x` : le navigateur du téléphone **refusera
le micro** sur cette adresse non sécurisée. Solutions : héberger le dossier `dist/` sur un hébergement
statique gratuit en HTTPS (Netlify, Cloudflare Pages, GitHub Pages…) ou utiliser un tunnel HTTPS.

## Tester le parcours prioritaire (14 étapes)

À la main :
1. Ouvrir l'application → 2. parcourir le fil → 3. « Témoigner » (barre du bas) →
4. saisir un titre et un texte → 5. appuyer sur le micro, parler (pause/reprise possibles), arrêter →
6. réécouter → 7. cocher les consentements, « Envoyer à la modération » →
8. menu ☰ → « Administration (démo locale) » → onglet Contributions →
9. ouvrir le témoignage, l'écouter → 10. « Valider et publier » →
11. revenir au fil : la publication est en tête → 12. l'écouter depuis sa carte →
13. actualiser la page (F5) → 14. la publication et sa voix sont toujours là.

Automatiquement (vrai navigateur Chromium, micro simulé qui produit un vrai flux audio) :

```bash
npm install -D playwright && npx playwright install chromium   # une seule fois
VITE_FORCE_LOCAL=1 npm run build && npx vite preview --port 4173 &   # mode local, dans un autre terminal
npm run test:e2e
```

Le script vérifie aussi que la contribution n'apparaît **pas** dans le fil avant validation,
que le chronomètre s'arrête pendant la pause, et qu'un refus du micro affiche un message clair.

## Organisation du code

```
src/
  models/types.ts        Modèles de données (publication, statuts, réactions…)
  services/
    db.ts                Accès IndexedDB (aucune dépendance)
    repository.ts        Couche « dépôt » : TOUTES les lectures/écritures passent ici (choisit local ou partagé)
    local.ts             Stockage dans le navigateur (mode local, brouillons, favoris, copies des envois)
    remote.ts            Base partagée Supabase (chargée seulement si configurée)
    store.tsx            État partagé React + rafraîchissement (y compris entre onglets)
    selectors.ts         Fil chronologique, recherche, filtres (aucun tri par popularité)
    preferences.ts       localStorage : thème, pseudonyme, vitesse de lecture
    transcription.ts     Interface prête pour Whisper (aucun moteur branché en V0.1)
  audio/
    AudioProvider.tsx    Lecteur unique : une seule voix à la fois, mini-lecteur
    useRecorder.ts       Enregistrement MediaRecorder, pause/reprise, onde en direct, erreurs
  components/            Carte, lecteur, onde, enregistreur, logo, icônes, modale…
  pages/                 Fil, Explorer, Témoigner, Les voix, Mon espace, Manifeste, Charte, Admin…
  data/                  Catégories initiales + exemples fictifs (marqués « Exemple fictif »)
  lib/                   Utilitaires, analyse audio, routeur par hash
  config.ts              Adresse + clé PUBLIQUE de Supabase (vide = mode local)
supabase/schema.sql      Tables, règles d'accès (RLS) et stockage des fichiers
supabase/tests/          Tests des règles d'accès + faux Supabase pour les tests
tests/parcours.e2e.mjs   Test automatisé du parcours en 14 étapes (mode local)
tests/partage.e2e.mjs    Test « plusieurs appareils » (base partagée)
docs/                    Architecture, limites, suite du projet
```

Les composants n'accèdent jamais au stockage directement : tout passe par `services/repository.ts`
(voir `docs/ARCHITECTURE.md`).

## Limites connues (honnêtement)

- **Mode local** : administration non sécurisée, et une contribution déposée sur un téléphone n'est
  visible que sur ce téléphone. Le mode « base partagée » corrige les deux.
- **Pas de comptes contributeurs** : « Mon espace » suit les contributions envoyées depuis cet appareil
  (grâce à un jeton secret gardé dans le navigateur).
- **Offre gratuite Supabase** : 1 Go de fichiers, mise en veille après 7 jours sans visite (réveil en un clic).
- **Transcription automatique non disponible** : saisie manuelle uniquement (aucune simulation).
- **Exemples fictifs** : 6 publications de démonstration, sons synthétiques (aucune voix réelle).
  Suppression en un clic : Administration → Paramètres et données.
- Effacer les données du site dans le navigateur efface tout. Pensez à l'export (Administration).
- Safari iOS : enregistrement en `audio/mp4`, pause/reprise selon la version.

Voir `CHANGELOG.md` pour le journal des modifications.

## Mise en ligne gratuite (GitHub Pages)

Le fichier `.github/workflows/deploy-pages.yml` construit et publie l'application à chaque envoi sur `main`.
Activation, une seule fois : dépôt GitHub → **Settings → Pages → Source : « GitHub Actions »**.
L'adresse sera `https://<compte>.github.io/humanisons-l-humain/` (HTTPS : le micro fonctionne sur smartphone).
GitHub Pages est gratuit pour un dépôt **public** ; pour un dépôt privé, il faut un abonnement GitHub payant.
En mode local, chaque appareil garde ses propres données ; en mode base partagée, tout le monde voit les mêmes publications.
