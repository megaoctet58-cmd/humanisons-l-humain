/**
 * Informations légales de l'éditeur, en un seul endroit.
 * Les valeurs vides s'affichent « à compléter » : ne rien inventer ici.
 */
export const LEGAL = {
  /** Particulier, association ou entreprise qui édite le site. */
  editeur: '',
  /** Nom complet du directeur ou de la directrice de la publication. */
  directeurPublication: '',
  /** Adresse e-mail de contact (RGPD, signalements, mot de passe oublié). */
  email: '',
  /** Adresse postale, ou vide si l'éditeur, particulier, use du droit à l'anonymat (LCEN art. 6 III-2). */
  adresse: '',
  /** SIREN / RNA si l'éditeur est une structure. */
  immatriculation: '',
  /** Région de la base Supabase choisie à la création du projet. */
  regionDonnees: '',
  /** Âge minimum pour contribuer ou créer un compte. */
  ageMinimum: 15,
  /** Date de dernière mise à jour des textes. */
  miseAJour: '26 novembre 2026',
};

export const aCompleter = (v: string) => v.trim() || '[à compléter]';
