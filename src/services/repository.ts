/**
 * Service de données de l'application (couche « dépôt »).
 *
 * Toute l'interface passe par ce module, qui choisit où ranger les données :
 *
 *  • Sans base partagée configurée (src/config.ts vide) : tout reste dans le
 *    navigateur de l'appareil, comme dans le prototype V0.1 (local.ts).
 *
 *  • Avec la base partagée (Supabase, remote.ts) :
 *      - publications, contributions envoyées, fichiers, signalements,
 *        catégories et paramètres sont partagés entre tous les appareils ;
 *      - les brouillons, les favoris et les réactions restent sur l'appareil ;
 *      - une copie de chaque contribution envoyée est gardée sur l'appareil,
 *        avec son jeton secret, pour la suivre dans « Mon espace ».
 */
import { REMOTE } from '../config';
import * as local from './local';
import * as remote from './remote';
import type { Category, MediaRef, Post, ReactionId, Report, Settings } from '../models/types';
import { getPseudonym, setPseudonym } from './preferences';
import { DEFAULT_CATEGORIES } from '../data/categories';

export const isRemote = REMOTE;
export const subscribe = local.subscribe;
const notify = local.notify;

/* ------------------------------------------------------------------ */
/* Connexion (administrateur ou compte contributeur facultatif)         */
/* ------------------------------------------------------------------ */

export type AuthState = remote.AuthState;

let authPromise: Promise<AuthState> | null = null;
let authWatching = false;

/** Qui est connecté (base partagée uniquement). En local, l'administration reste ouverte comme en V0.1. */
export function getAuth(): Promise<AuthState> {
  if (!REMOTE) return Promise.resolve({ isAdmin: true });
  if (!authWatching) {
    authWatching = true;
    remote
      .onAuthChange(() => {
        authPromise = null;
        notify();
      })
      .catch(() => (authWatching = false));
  }
  if (!authPromise) {
    authPromise = remote.authState().catch(() => ({ isAdmin: false }));
  }
  return authPromise;
}

export async function signIn(email: string, password: string): Promise<AuthState> {
  await remote.signIn(email, password);
  authPromise = null;
  const a = await getAuth();
  await syncAfterLogin(a).catch(() => undefined);
  notify();
  return a;
}

/** Création d'un compte contributeur (facultatif). */
export async function signUp(email: string, password: string): Promise<AuthState> {
  const connected = await remote.signUp(email, password);
  if (!connected) throw new Error('Compte créé. Confirmez votre adresse grâce à l’e-mail reçu, puis connectez-vous.');
  authPromise = null;
  const a = await getAuth();
  await syncAfterLogin(a).catch(() => undefined);
  notify();
  return a;
}

/**
 * À la connexion : rattache au compte ce qui a été fait sur cet appareil
 * (contributions envoyées, brouillons, favoris, réactions, pseudonyme).
 */
async function syncAfterLogin(a: AuthState) {
  if (!a.userId) return;
  const localAll = await local.listPosts();
  const sent = localAll.filter((p) => p.mine && p.status !== 'brouillon' && p.private.ownerToken);
  await remote.claimContributions(sent.map((p) => ({ id: p.id, token: p.private.ownerToken! })));
  for (const d of localAll.filter((p) => p.status === 'brouillon')) await pushDraft(a.userId, d).catch(() => undefined);
  const [ud, favs, reacts] = await Promise.all([remote.getUserData(), local.getFavorites(), local.getMyReactions()]);
  const mergedFavs = [...new Set([...(ud?.favorites ?? []), ...favs])];
  const mergedReacts: Record<string, ReactionId[]> = { ...(ud?.reactions ?? {}) };
  for (const [k, v] of Object.entries(reacts)) mergedReacts[k] = [...new Set([...(mergedReacts[k] ?? []), ...v])];
  const pseudonym = ud?.pseudonym || getPseudonym() || null;
  if (pseudonym) setPseudonym(pseudonym);
  await remote.saveUserData(a.userId, { favorites: mergedFavs, reactions: mergedReacts, pseudonym });
}

/** Supprime le compte contributeur (ses brouillons en ligne et leurs fichiers compris). */
export async function deleteAccount(): Promise<void> {
  const drafts = await remote.listDrafts().catch(() => [] as Post[]);
  const ids = drafts.flatMap((d) => mediaRefs(d).map((r) => r.id));
  await remote.removeMedia(ids).catch(() => undefined);
  await remote.deleteAccount();
  authPromise = Promise.resolve({ isAdmin: false });
  notify();
}

/** Pseudonyme proposé par défaut (synchronisé avec le compte si l'on est connecté). */
export async function savePseudonym(p: string): Promise<void> {
  setPseudonym(p);
  const a = await getAuth();
  if (REMOTE && a.userId) await remote.saveUserData(a.userId, { pseudonym: p.trim() || null });
}

export async function signOut(): Promise<void> {
  await remote.signOut();
  authPromise = Promise.resolve({ isAdmin: false });
  notify();
}

async function requireAdmin(what: string) {
  if (!(await getAuth()).isAdmin) throw new Error(`${what} : connexion administrateur requise.`);
}

/* ------------------------------------------------------------------ */
/* Publications                                                        */
/* ------------------------------------------------------------------ */

let lastPosts = new Map<string, Post>();

function mediaRefs(p?: Post): MediaRef[] {
  if (!p) return [];
  return [...p.images, ...(p.audio ? [p.audio] : []), ...(p.private.proofs ?? [])];
}

export async function listPosts(): Promise<Post[]> {
  if (!REMOTE) return local.listPosts();
  const auth = await getAuth();
  const localAll = await local.listPosts();
  const keepLocal = localAll.filter((p) => p.status === 'brouillon' || p.mine);
  const remotePosts = await remote.listPosts(auth.isAdmin);
  const map = new Map(remotePosts.map((p) => [p.id, p]));

  const sent = keepLocal.filter((p) => p.mine && p.status !== 'brouillon' && p.private.ownerToken);
  const signedIn = Boolean(auth.userId);
  const tracked = await remote
    .myContributions(
      sent.map((p) => ({ id: p.id, token: p.private.ownerToken! })),
      signedIn,
    )
    .catch(() => [] as remote.Tracked[]);
  const trackedById = new Map(tracked.map((t) => [t.id, t]));

  // Compte connecté : brouillons et contributions envoyées depuis d'autres appareils.
  if (signedIn) {
    const localIds = new Set(keepLocal.map((p) => p.id));
    const drafts = await remote.listDrafts().catch(() => [] as Post[]);
    for (const d of drafts) {
      const lp = keepLocal.find((p) => p.id === d.id);
      if (!lp) keepLocal.push(d);
      else if (lp.status === 'brouillon' && d.updatedAt > lp.updatedAt) keepLocal[keepLocal.indexOf(lp)] = d;
    }
    for (const t of tracked) {
      if (localIds.has(t.id)) continue;
      const r = map.get(t.id);
      map.set(t.id, {
        ...(r ?? remote.fromRow({ ...t, created_at: t.created_at ?? undefined })),
        mine: true,
        private: {
          ...(r?.private ?? {}),
          email: t.email ?? undefined,
          proofs: t.proofs ?? undefined,
          messageToAuthor: t.message_to_author ?? undefined,
          withdrawalRequested: t.withdrawal_requested || undefined,
        },
      });
    }
  }

  for (const lp of keepLocal) {
    const r = map.get(lp.id);
    const t = trackedById.get(lp.id);
    if (lp.status === 'brouillon') {
      if (t) {
        // Brouillon envoyé depuis un autre appareil du même compte : la copie locale n'a plus lieu d'être.
        local.deletePost(lp.id).catch(() => undefined);
      } else {
        if (!r) map.set(lp.id, lp);
        continue;
      }
    }
    const base = r ?? (t ? remote.fromRow({ ...t, created_at: t.created_at ?? undefined }) : lp);
    map.set(lp.id, {
      ...base,
      mine: true,
      private: {
        ...lp.private,
        ...(r?.private ?? {}),
        ...(t ? { messageToAuthor: t.message_to_author ?? undefined, withdrawalRequested: t.withdrawal_requested || undefined, proofs: t.proofs ?? lp.private.proofs } : {}),
        ownerToken: lp.private.ownerToken,
      },
    });
  }
  const all = [...map.values()];
  lastPosts = map;
  return all;
}

export async function getPost(id: string): Promise<Post | undefined> {
  if (!REMOTE) return local.getPost(id);
  return lastPosts.get(id) ?? local.getPost(id);
}

/** Fichiers déjà présents dans la base partagée (pendant cette visite). */
const uploaded = new Set<string>();

async function uploadRefs(p: Post) {
  for (const ref of mediaRefs(p)) {
    if (uploaded.has(ref.id)) continue;
    const blob = await local.getMediaBlob(ref.id);
    if (!blob) continue; // déjà en ligne (rien à envoyer depuis cet appareil)
    await remote.uploadMedia(ref.id, blob);
    uploaded.add(ref.id);
  }
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Brouillon d'un compte connecté : enregistré en ligne (le texte d'abord, puis les fichiers). */
async function pushDraft(userId: string, post: Post) {
  await remote.saveDraft(userId, post);
  await uploadRefs(post);
}

export async function savePost(post: Post): Promise<Post> {
  if (!REMOTE) return local.savePost(post);
  const auth = await getAuth();

  if (post.status === 'brouillon') {
    const saved = await local.savePost(post);
    if (auth.userId) await pushDraft(auth.userId, saved).catch(() => undefined); // reste au moins sur l'appareil
    return saved;
  }
  if (auth.userId) remote.deleteDraft(post.id).catch(() => undefined);

  if (auth.isAdmin) {
    await uploadRefs(post);
    const saved = await remote.upsertPost(post);
    const loc = await local.getPost(post.id);
    if (loc && loc.status === 'brouillon' && !loc.mine) await local.deletePost(post.id); // le brouillon du fondateur est maintenant en ligne
    notify();
    return saved;
  }

  // Contributeur (avec ou sans compte) : il ne peut qu'envoyer à la modération.
  if (post.status !== 'en_attente') throw new Error('Publication directe : connexion administrateur requise.');
  const loc = await local.getPost(post.id);
  const token = post.private.ownerToken ?? loc?.private.ownerToken ?? randomToken();
  const toSend: Post = { ...post, mine: true, private: { ...post.private, ownerToken: token } };
  await remote.submitContribution(toSend, token);
  await local.savePost(toSend); // copie sur l'appareil, avec le jeton, pour le suivi
  try {
    await uploadRefs(toSend);
  } catch (e) {
    throw new Error(`Votre texte est bien arrivé, mais un fichier n’a pas pu être envoyé. Réessayez l’envoi. (${e instanceof Error ? e.message : e})`);
  }
  return toSend;
}

/** Demande de retrait d'une contribution envoyée depuis cet appareil. */
export async function requestWithdrawal(post: Post, reason?: string): Promise<void> {
  const updated: Post = { ...post, private: { ...post.private, withdrawalRequested: true, withdrawalReason: reason } };
  if (REMOTE && (post.private.ownerToken || (await getAuth()).userId)) {
    await remote.requestWithdrawal(post.id, post.private.ownerToken ?? '', reason);
    const loc = await local.getPost(post.id);
    if (loc) await local.savePost({ ...loc, private: { ...loc.private, withdrawalRequested: true, withdrawalReason: reason } });
    else notify();
    return;
  }
  await savePost(updated);
}

/** Supprime une publication ainsi que ses fichiers associés. */
export async function deletePost(id: string): Promise<void> {
  if (!REMOTE) return local.deletePost(id);
  const loc = await local.getPost(id);
  const known = lastPosts.get(id);
  const auth = await getAuth();
  if (auth.userId && (known ?? loc)?.status === 'brouillon') {
    await remote.removeMedia(mediaRefs(known ?? loc).map((r) => r.id)).catch(() => undefined);
    await remote.deleteDraft(id).catch(() => undefined);
  }
  if (known && known.status !== 'brouillon' && auth.isAdmin) {
    await remote.deletePost(
      id,
      mediaRefs(known).map((r) => r.id),
    );
  }
  if (loc) await local.deletePost(id);
  notify();
}

/* ------------------------------------------------------------------ */
/* Fichiers (audio, images, justificatifs)                             */
/* ------------------------------------------------------------------ */

/** Les fichiers sont d'abord rangés sur l'appareil, puis envoyés avec la contribution. */
export const saveMedia = local.saveMedia;

export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  const b = await local.getMediaBlob(id);
  if (b || !REMOTE) return b;
  return remote.downloadMedia(id);
}

const urlCache = new Map<string, string>();

/** URL locale (blob:) utilisable par <audio> ou <img>. Mise en cache. */
export async function mediaUrl(id: string): Promise<string | undefined> {
  if (!REMOTE) return local.mediaUrl(id);
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getMediaBlob(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteMedia(id: string): Promise<void> {
  await local.deleteMedia(id);
  if (!REMOTE) return;
  const u = urlCache.get(id);
  if (u) URL.revokeObjectURL(u);
  urlCache.delete(id);
  uploaded.delete(id);
  // Admin : tout fichier. Compte contributeur : seulement les fichiers de ses brouillons (règle de la base).
  const a = await getAuth();
  if (a.isAdmin || a.userId) await remote.removeMedia([id]).catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Catégories, paramètres (partagés) · favoris, réactions (appareil)   */
/* ------------------------------------------------------------------ */

export async function getCategories(): Promise<Category[]> {
  if (!REMOTE) return local.getCategories();
  const c = await remote.getKv<Category[]>('categories');
  return (c ?? DEFAULT_CATEGORIES).slice().sort((a, b) => a.order - b.order);
}

export async function saveCategories(cats: Category[]): Promise<void> {
  if (!REMOTE) return local.saveCategories(cats);
  await requireAdmin('Catégories');
  await remote.setKv(
    'categories',
    cats.map((c, i) => ({ ...c, order: i })),
  );
  notify();
}

const DEFAULT_SETTINGS: Settings = { founderName: 'Jérémy', maxAudioSeconds: 300 };

export async function getSettings(): Promise<Settings> {
  if (!REMOTE) return local.getSettings();
  return { ...DEFAULT_SETTINGS, ...((await remote.getKv<Settings>('settings')) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  if (!REMOTE) return local.saveSettings(s);
  await requireAdmin('Paramètres');
  await remote.setKv('settings', s);
  notify();
}

/** Compte connecté : favoris et réactions suivent la personne sur tous ses appareils. */
async function accountData(): Promise<{ userId: string; data: remote.UserData } | undefined> {
  if (!REMOTE) return undefined;
  const a = await getAuth();
  if (!a.userId) return undefined;
  const data = (await remote.getUserData().catch(() => undefined)) ?? { favorites: [], reactions: {} };
  return { userId: a.userId, data };
}

export async function getFavorites(): Promise<string[]> {
  const acc = await accountData();
  return acc ? acc.data.favorites : local.getFavorites();
}

export async function toggleFavorite(postId: string): Promise<boolean> {
  const acc = await accountData();
  if (!acc) return local.toggleFavorite(postId);
  const has = acc.data.favorites.includes(postId);
  const favorites = has ? acc.data.favorites.filter((f) => f !== postId) : [postId, ...acc.data.favorites];
  await remote.saveUserData(acc.userId, { favorites });
  notify();
  return !has;
}

export async function getMyReactions(): Promise<Record<string, ReactionId[]>> {
  const acc = await accountData();
  return acc ? acc.data.reactions : local.getMyReactions();
}

export async function toggleReaction(postId: string, r: ReactionId): Promise<void> {
  const acc = await accountData();
  if (!acc) return local.toggleReaction(postId, r);
  const all = { ...acc.data.reactions };
  const cur = all[postId] ?? [];
  all[postId] = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
  await remote.saveUserData(acc.userId, { reactions: all });
  notify();
}

/* ------------------------------------------------------------------ */
/* Signalements                                                        */
/* ------------------------------------------------------------------ */

export async function addReport(postId: string, reason: string, details?: string): Promise<void> {
  if (!REMOTE) return local.addReport(postId, reason, details);
  await remote.reportPost(postId, reason, details);
  notify();
}

export async function listReports(): Promise<Report[]> {
  if (!REMOTE) return local.listReports();
  if (!(await getAuth()).isAdmin) return [];
  return remote.listReports();
}

export async function saveReport(r: Report): Promise<void> {
  if (!REMOTE) return local.saveReport(r);
  await remote.saveReport(r);
  notify();
}

/* ------------------------------------------------------------------ */
/* Maintenance : démo, export, réinitialisation, migration             */
/* ------------------------------------------------------------------ */

export const isSeeded = local.isSeeded;
export const markSeeded = local.markSeeded;

export async function removeDemoData(): Promise<number> {
  if (!REMOTE) return local.removeDemoData();
  const demo = (await listPosts()).filter((p) => p.demo);
  for (const p of demo) await deletePost(p.id);
  return demo.length;
}

/** Efface les données de CET appareil uniquement. */
export const resetAll = local.resetAll;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Exporte toutes les données (base partagée : sauvegarde complète, fichiers compris). */
export async function exportAll(): Promise<Blob> {
  if (!REMOTE) return local.exportAll();
  await requireAdmin('Export');
  const [posts, reports, categories, favorites, reactions, settings] = await Promise.all([
    listPosts(),
    listReports(),
    getCategories(),
    getFavorites(),
    getMyReactions(),
    getSettings(),
  ]);
  const shared = posts.filter((p) => p.status !== 'brouillon').map((p) => ({ ...p, private: { ...p.private, ownerToken: undefined } }));
  const media = [];
  const seen = new Set<string>();
  for (const ref of shared.flatMap((p) => mediaRefs(p))) {
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    const blob = await getMediaBlob(ref.id);
    if (blob) media.push({ id: ref.id, mime: ref.mime, name: ref.name, createdAt: new Date().toISOString(), dataUrl: await blobToDataUrl(blob) });
  }
  const data = { format: 'hlh-export', version: 1, exportedAt: new Date().toISOString(), posts: shared, reports, categories, favorites, reactions, settings, media };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/**
 * Restaure une sauvegarde.
 * Local : remplace les données de l'appareil. Base partagée : ajoute ou met à jour
 * les publications de la sauvegarde (rien n'est effacé).
 */
export async function importAll(file: Blob): Promise<number> {
  if (!REMOTE) return local.importAll(file);
  await requireAdmin('Restauration');
  const data = JSON.parse(await file.text());
  if (data?.format !== 'hlh-export') throw new Error("Ce fichier n'est pas un export HUMANISONS L'HUMAIN.");
  for (const m of data.media ?? []) {
    const blob = await (await fetch(m.dataUrl)).blob();
    await local.putMedia(m.id, blob, m.name);
  }
  let n = 0;
  for (const p of (data.posts ?? []) as Post[]) {
    if (p.status === 'brouillon') continue;
    await pushToShared(p);
    n++;
  }
  if (data.categories) await saveCategories(data.categories);
  if (data.settings) await saveSettings(data.settings);
  notify();
  return n;
}

async function pushToShared(p: Post) {
  const { mine: _mine, ...rest } = p;
  void _mine;
  await uploadRefs(p);
  await remote.upsertPost({ ...rest, private: { ...(p.private ?? {}) } } as Post);
}

/**
 * Publications et contributions enregistrées sur cet appareil avec la V0.1 (avant la base
 * partagée), hors brouillons et exemples fictifs. Celles envoyées depuis ont un jeton.
 */
export async function localOnlyPosts(): Promise<Post[]> {
  if (!REMOTE) return [];
  return (await local.listPosts()).filter((p) => p.status !== 'brouillon' && !p.demo && !p.private.ownerToken);
}

/** Envoie dans la base partagée ce qui avait été publié ou modéré sur cet appareil avec la V0.1. */
export async function migrateLocalToShared(): Promise<number> {
  await requireAdmin('Transfert');
  const posts = await localOnlyPosts();
  for (const p of posts) await pushToShared(p);
  if (!(await remote.getKv('categories'))) {
    const cats = await local.getCategories();
    await remote.setKv('categories', cats);
  }
  for (const p of posts) await local.deletePost(p.id);
  notify();
  return posts.length;
}
