# Journal des modifications

## V0.3.0 — 26 novembre 2026

- **Comptes contributeurs facultatifs** (e-mail + mot de passe) : contributions, brouillons (avec leurs
  fichiers), favoris, réactions et pseudonyme retrouvés sur tous les appareils. À la connexion, ce qui
  a été fait sur l'appareil est rattaché au compte. Suppression du compte depuis « Mon espace ».
  Chaque compte ne lit que ses propres données (60 vérifications automatiques des règles d'accès).
- **Transcription automatique gratuite** dans le navigateur (Whisper « base », Transformers.js) :
  l'enregistrement ne quitte pas l'appareil, le texte est proposé puis corrigé par l'auteur, la
  mention « transcription automatique corrigée par l'auteur » s'affiche.
- **Pages légales** : politique de confidentialité, conditions d'utilisation, mentions légales
  (identité de l'éditeur dans `src/data/legal.ts`). Liens dans le menu et au moment du consentement.
- Tests : `tests/comptes.e2e.mjs` (deux appareils, un compte).

## V0.2.0 — 26 novembre 2026

Base partagée (Supabase, offre gratuite), branchée le 26 novembre 2026 (projet tzflxdyngkrunueqrojl).
Sans configuration, le site fonctionne exactement comme la V0.1.

- Publications, contributions, voix, images, signalements, catégories et paramètres partagés
  entre tous les appareils.
- Administration protégée par e-mail + mot de passe ; seuls les comptes de la table `admins`
  administrent. Protection réelle dans la base (règles RLS), pas seulement dans l'interface.
- Contributions en attente, e-mails, justificatifs, notes et voix non autorisées : jamais lisibles
  publiquement (39 vérifications automatiques des règles d'accès).
- « Mon espace » suit le statut des contributions envoyées depuis l'appareil, affiche le message de
  la modération, permet de compléter et de demander le retrait.
- Transfert en un clic des publications restées sur un appareil (V0.1) vers la base partagée.
- Sauvegarde complète (fichiers et données privées compris) et restauration depuis l'administration.
- Textes « À propos » et « Mon espace » adaptés au mode partagé.
- Tests : `supabase/tests/rls-test.sql` et `tests/partage.e2e.mjs` (trois appareils, 14 étapes).

## V0.1.1 — 26 novembre 2026

- Le fondateur apparaît sous son nom : « Jérémy » par défaut (modifiable dans Administration → Paramètres), signature du manifeste.

## V0.1.0 — 26 novembre 2026

Première version fonctionnelle locale.

- Logo validé (onde terracotta, titre en capitales, signature), thèmes clair/sombre mémorisés.
- Fil chronologique, filtres par type et catégorie, message de fin de fil (pas de défilement infini).
- Cartes : auteur/anonyme, catégorie, paradoxe promesse/réalité, images, sources, mention de vérification,
  réactions empathiques (sans compteur public), favoris, partage, signalement, URL propre `#/publication/<id>`.
- Lecteur audio intégré dans la carte : « La voix du témoin », onde cliquable, progression, durée,
  vitesse, transcription repliable, mention « Voix originale ». Une seule lecture à la fois.
  Mini-lecteur persistant quand on continue à défiler. Aucune lecture automatique.
- Témoigner : écrire / ma voix / les deux ; enregistrement réel (pause, reprise, arrêt, chronomètre,
  onde en direct, arrêt automatique à 5 min), réécoute, suppression, import de fichier audio,
  transcription manuelle, images, liens/sources, justificatifs privés, e-mail privé, anonymat,
  choix « publier ma voix » ou « transcription seulement », consentements, aperçu, brouillons.
- Gestion des erreurs du micro (refus, absence, micro occupé, contexte non sécurisé).
- Explorer : recherche plein texte (sans accents), type, catégorie, période, « avec la voix ».
- Les voix humaines, Mon espace (contributions et statuts, brouillons, favoris, profil, demande de retrait).
- Administration locale : tableau de bord, file de modération, écoute de l'original, informations privées,
  notes internes, niveau de vérification, valider/publier, refuser, demander des précisions, programmer,
  dépublier, archiver, retirer, supprimer, modifier ; signalements ; catégories (ajout, renommage,
  réordonnancement, suppression) ; paramètres ; export/restauration JSON (médias inclus) ; données de démo.
- Manifeste, charte éthique, page « À propos et limites ».
- Test automatisé du parcours en 14 étapes (réussi).
