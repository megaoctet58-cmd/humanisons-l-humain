# HUMANISONS L'HUMAIN (HLH) — Prototype V0.1

> Un réseau humain plutôt qu'un réseau social.
> Observer · Écouter · Questionner · Humaniser.

Prototype **local** et fonctionnel : fil chronologique, témoignages écrits et vocaux (vrai micro),
modération locale, réactions empathiques, favoris, brouillons, thèmes clair/sombre.
Toutes les données restent dans le navigateur (IndexedDB). Aucun service payant, aucun traceur.

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
npm run build && npx vite preview --port 4173 &                 # dans un autre terminal
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
    repository.ts        Couche « dépôt » : TOUTES les lectures/écritures passent ici
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
tests/parcours.e2e.mjs   Test automatisé du parcours en 14 étapes
docs/                    Architecture, limites, suite du projet
```

Les composants n'accèdent jamais à IndexedDB directement : pour passer à Supabase/PostgreSQL,
on remplace `services/repository.ts` (voir `docs/ARCHITECTURE.md`).

## Limites connues (honnêtement)

- **Administration non sécurisée** : pas de mot de passe, accessible à quiconque utilise le navigateur.
- **Pas de vrais comptes** : « Mon espace » = cet appareil.
- **Données locales** : une contribution déposée sur un téléphone n'est visible que sur ce téléphone.
  La modération se fait donc sur le même appareil. Un vrai serveur est l'objet de la phase 4.
- **Transcription automatique non disponible** : saisie manuelle uniquement (aucune simulation).
- **Exemples fictifs** : 6 publications de démonstration, sons synthétiques (aucune voix réelle).
  Suppression en un clic : Administration → Paramètres et données.
- Effacer les données du site dans le navigateur efface tout. Pensez à l'export (Administration).
- Safari iOS : enregistrement en `audio/mp4`, pause/reprise selon la version.

Voir `CHANGELOG.md` pour le journal des modifications.
