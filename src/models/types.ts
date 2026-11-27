/**
 * Modèles de données de HUMANISONS L'HUMAIN.
 *
 * Ces types sont indépendants du stockage : en V0.1 ils sont conservés dans
 * IndexedDB (navigateur), plus tard ils pourront correspondre à des tables
 * PostgreSQL / Supabase sans changer les composants d'interface.
 */

export type PostType = 'temoignage' | 'actualite' | 'reflexion' | 'paradoxe' | 'instantane' | 'espoir';

export const POST_TYPES: { id: PostType; label: string; plural: string; description: string }[] = [
  { id: 'temoignage', label: 'Témoignage', plural: 'Témoignages', description: 'Une expérience réellement vécue.' },
  { id: 'actualite', label: 'Actualité', plural: 'Actualités', description: 'Un événement de société, avec des sources consultables.' },
  { id: 'reflexion', label: 'Réflexion', plural: 'Réflexions', description: 'Une opinion, une interrogation philosophique ou une analyse.' },
  { id: 'paradoxe', label: 'Paradoxe', plural: 'Paradoxes', description: 'Une promesse affichée face à la réalité constatée.' },
  { id: 'instantane', label: 'Instantané du monde', plural: 'Instantanés du monde', description: 'Une photo, une affiche, une situation observée au quotidien.' },
  { id: 'espoir', label: "Lueur d'espoir", plural: 'Espoir', description: "Une initiative qui remet l'humain au premier plan." },
];

export function typeLabel(t: PostType): string {
  return POST_TYPES.find((p) => p.id === t)?.label ?? t;
}

/** Cycle de vie d'une publication / contribution. */
export type PostStatus =
  | 'brouillon'
  | 'en_attente'
  | 'en_verification'
  | 'infos_demandees'
  | 'valide'
  | 'programme'
  | 'publie'
  | 'refuse'
  | 'archive'
  | 'retire';

export const STATUS_LABELS: Record<PostStatus, string> = {
  brouillon: 'Brouillon',
  en_attente: 'En attente de modération',
  en_verification: 'En cours de vérification',
  infos_demandees: 'Informations complémentaires demandées',
  valide: 'Validé',
  programme: 'Programmé',
  publie: 'Publié',
  refuse: 'Refusé',
  archive: 'Archivé',
  retire: 'Retiré',
};

/** Niveau de vérification affiché publiquement (honnêteté éditoriale). */
export type VerificationLevel = 'non_verifie' | 'coherence_examinee' | 'sources_verifiees' | 'a_documenter';

export const VERIFICATION_LABELS: Record<VerificationLevel, string> = {
  non_verifie: 'Non vérifié',
  coherence_examinee: 'Cohérence examinée par la modération',
  sources_verifiees: 'Sources vérifiées',
  a_documenter: 'À documenter',
};

/** Référence vers un fichier stocké (audio, image, justificatif). */
export interface MediaRef {
  id: string; // clé dans le magasin "media"
  mime: string;
  name?: string;
  size?: number;
}

export interface AudioInfo extends MediaRef {
  duration: number; // secondes
  peaks: number[]; // 0..1, pour dessiner l'onde
  /** true : la voix enregistrée ou importée par l'auteur, sans modification. */
  original: boolean;
  /** true : audio de démonstration synthétique (aucune voix réelle). */
  synthetic?: boolean;
  source: 'micro' | 'import' | 'demo';
  /** L'auteur autorise la diffusion publique de sa voix. Sinon : seule la transcription est publiée. */
  publishVoice: boolean;
}

export interface SourceLink {
  label: string;
  url: string;
}

/** Données privées : jamais affichées publiquement. */
export interface PrivateInfo {
  email?: string;
  proofs?: MediaRef[]; // justificatifs privés
  moderationNotes?: string; // notes internes
  messageToAuthor?: string; // demande de précisions / proposition de modifications
  withdrawalRequested?: boolean;
  withdrawalReason?: string;
  /** Pseudonyme saisi par un auteur qui a choisi l'anonymat (visible de la modération seulement). */
  hiddenAuthorName?: string;
  /**
   * Département déclaré par l'auteur (facultatif, code INSEE, « COM » ou « HF »).
   * Jamais affiché sur la publication : il ne sert qu'à la carte, en nombres.
   */
  department?: string;
  /**
   * Jeton secret gardé UNIQUEMENT sur l'appareil du contributeur : il lui permet
   * de suivre sa contribution et d'en demander le retrait. La base n'en conserve
   * qu'une empreinte (sha256), jamais le jeton lui-même.
   */
  ownerToken?: string;
}

export interface Post {
  id: string;
  type: PostType;
  title: string;
  categoryId: string;
  text: string;
  reflection?: string;
  /** Pour les paradoxes. */
  promise?: string;
  reality?: string;
  authorName?: string;
  anonymous: boolean;
  /** true pour les publications du fondateur. */
  byFounder?: boolean;
  images: MediaRef[];
  audio?: AudioInfo;
  transcription?: string;
  transcriptionSource?: 'manuelle' | 'automatique';
  sources: SourceLink[];
  verification: VerificationLevel;
  status: PostStatus;
  consent: { publication: boolean; voiceIdentifiable: boolean; at?: string };
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  publishedAt?: string;
  scheduledAt?: string;
  /** Contribution créée sur cet appareil (sert à « Mon espace » en V0.1). */
  mine?: boolean;
  /** Donnée de démonstration fictive, clairement identifiée. */
  demo?: boolean;
  private: PrivateInfo;
}

export interface Category {
  id: string;
  name: string;
  order: number;
}

export type ReactionId = 'parle' | 'soutiens' | 'touche' | 'indigne' | 'questionne' | 'espoir';

export const REACTIONS: { id: ReactionId; label: string; icon: string }[] = [
  { id: 'parle', label: 'Ça me parle', icon: 'speak' },
  { id: 'soutiens', label: 'Je vous soutiens', icon: 'hand' },
  { id: 'touche', label: 'Ça me touche', icon: 'drop' },
  { id: 'indigne', label: "Ça m'indigne", icon: 'bolt' },
  { id: 'questionne', label: 'Ça me questionne', icon: 'question' },
  { id: 'espoir', label: 'Ça me donne espoir', icon: 'sun' },
];

export interface Report {
  id: string;
  postId: string;
  reason: string;
  details?: string;
  createdAt: string;
  status: 'ouvert' | 'traite' | 'rejete';
}

export interface Settings {
  founderName: string;
  maxAudioSeconds: number;
}

/** Une publication est visible publiquement si elle est publiée (ou programmée et l'heure est passée). */
export function isPublic(p: Post, now = Date.now()): boolean {
  if (p.status === 'publie') return true;
  if (p.status === 'programme' && p.scheduledAt) return new Date(p.scheduledAt).getTime() <= now;
  return false;
}

export function publicDate(p: Post): string {
  return p.publishedAt ?? p.scheduledAt ?? p.createdAt;
}

export function displayAuthor(p: Post): string {
  if (p.anonymous || !p.authorName?.trim()) return p.type === 'temoignage' ? 'Témoignage anonyme' : 'Une voix anonyme';
  return p.authorName.trim();
}
