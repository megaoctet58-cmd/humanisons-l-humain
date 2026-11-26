/**
 * Service de données de l'application (couche « dépôt »).
 *
 * Toute l'interface passe par ce module. En V0.1 il s'appuie sur IndexedDB
 * (stockage local du navigateur). Une future version pourra le remplacer par
 * une implémentation Supabase / PostgreSQL en gardant les mêmes fonctions.
 */
import * as db from './db';
import type { Category, MediaRef, Post, ReactionId, Report, Settings } from '../models/types';
import { DEFAULT_CATEGORIES } from '../data/categories';
import { uid } from '../lib/util';

interface MediaRecord {
  id: string;
  blob: Blob;
  mime: string;
  name?: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Notification des changements (y compris entre onglets)             */
/* ------------------------------------------------------------------ */

type Listener = () => void;
const listeners = new Set<Listener>();
let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel('hlh-data');
  channel.onmessage = () => listeners.forEach((l) => l());
} catch {
  channel = null;
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function notify() {
  listeners.forEach((l) => l());
  try {
    channel?.postMessage('changed');
  } catch {
    /* ignoré */
  }
}

/* ------------------------------------------------------------------ */
/* Publications                                                        */
/* ------------------------------------------------------------------ */

export async function listPosts(): Promise<Post[]> {
  return db.getAll<Post>('posts');
}

export async function getPost(id: string): Promise<Post | undefined> {
  return db.get<Post>('posts', id);
}

export async function savePost(post: Post): Promise<Post> {
  const p = { ...post, updatedAt: new Date().toISOString() };
  await db.put('posts', p);
  notify();
  return p;
}

/** Supprime une publication ainsi que ses fichiers associés. */
export async function deletePost(id: string): Promise<void> {
  const p = await getPost(id);
  if (p) {
    const refs = [...p.images, ...(p.audio ? [p.audio] : []), ...(p.private.proofs ?? [])];
    await Promise.all(refs.map((r) => deleteMedia(r.id)));
  }
  await db.del('posts', id);
  notify();
}

/* ------------------------------------------------------------------ */
/* Fichiers (audio, images, justificatifs)                             */
/* ------------------------------------------------------------------ */

const urlCache = new Map<string, string>();

export async function saveMedia(blob: Blob, name?: string): Promise<MediaRef> {
  const id = uid('m');
  const rec: MediaRecord = { id, blob, mime: blob.type || 'application/octet-stream', name, createdAt: new Date().toISOString() };
  await db.put('media', rec);
  return { id, mime: rec.mime, name, size: blob.size };
}

export async function getMediaBlob(id: string): Promise<Blob | undefined> {
  const rec = await db.get<MediaRecord>('media', id);
  return rec?.blob;
}

/** URL locale (blob:) utilisable par <audio> ou <img>. Mise en cache. */
export async function mediaUrl(id: string): Promise<string | undefined> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const blob = await getMediaBlob(id);
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteMedia(id: string): Promise<void> {
  const url = urlCache.get(id);
  if (url) URL.revokeObjectURL(url);
  urlCache.delete(id);
  await db.del('media', id);
}

/* ------------------------------------------------------------------ */
/* Petites valeurs : catégories, favoris, réactions, paramètres        */
/* ------------------------------------------------------------------ */

export async function getCategories(): Promise<Category[]> {
  const c = await db.get<Category[]>('kv', 'categories');
  return (c ?? DEFAULT_CATEGORIES).slice().sort((a, b) => a.order - b.order);
}

export async function saveCategories(cats: Category[]): Promise<void> {
  await db.put('kv', cats.map((c, i) => ({ ...c, order: i })), 'categories');
  notify();
}

export async function getFavorites(): Promise<string[]> {
  return (await db.get<string[]>('kv', 'favorites')) ?? [];
}

export async function toggleFavorite(postId: string): Promise<boolean> {
  const favs = await getFavorites();
  const has = favs.includes(postId);
  await db.put('kv', has ? favs.filter((f) => f !== postId) : [postId, ...favs], 'favorites');
  notify();
  return !has;
}

/** Réactions de la personne sur cet appareil. Aucun compteur public n'est calculé ni affiché. */
export async function getMyReactions(): Promise<Record<string, ReactionId[]>> {
  return (await db.get<Record<string, ReactionId[]>>('kv', 'reactions')) ?? {};
}

export async function toggleReaction(postId: string, r: ReactionId): Promise<void> {
  const all = await getMyReactions();
  const cur = all[postId] ?? [];
  all[postId] = cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r];
  await db.put('kv', all, 'reactions');
  notify();
}

const DEFAULT_SETTINGS: Settings = { founderName: 'Jérémy', maxAudioSeconds: 300 };

export async function getSettings(): Promise<Settings> {
  return { ...DEFAULT_SETTINGS, ...((await db.get<Settings>('kv', 'settings')) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.put('kv', s, 'settings');
  notify();
}

/* ------------------------------------------------------------------ */
/* Signalements                                                        */
/* ------------------------------------------------------------------ */

export async function addReport(postId: string, reason: string, details?: string): Promise<void> {
  const r: Report = { id: uid('r'), postId, reason, details, createdAt: new Date().toISOString(), status: 'ouvert' };
  await db.put('reports', r);
  notify();
}

export async function listReports(): Promise<Report[]> {
  return (await db.getAll<Report>('reports')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveReport(r: Report): Promise<void> {
  await db.put('reports', r);
  notify();
}

/* ------------------------------------------------------------------ */
/* Maintenance : démo, export, réinitialisation                        */
/* ------------------------------------------------------------------ */

export async function isSeeded(): Promise<boolean> {
  return Boolean(await db.get<boolean>('kv', 'seeded'));
}

export async function markSeeded(): Promise<void> {
  await db.put('kv', true, 'seeded');
}

export async function removeDemoData(): Promise<number> {
  const posts = await listPosts();
  const demo = posts.filter((p) => p.demo);
  for (const p of demo) await deletePost(p.id);
  return demo.length;
}

export async function resetAll(): Promise<void> {
  urlCache.forEach((u) => URL.revokeObjectURL(u));
  urlCache.clear();
  await db.clearAll();
  notify();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Exporte toutes les données locales (y compris les médias en base64) dans un fichier JSON. */
export async function exportAll(): Promise<Blob> {
  const [posts, reports, categories, favorites, reactions, settings, media] = await Promise.all([
    listPosts(),
    listReports(),
    getCategories(),
    getFavorites(),
    getMyReactions(),
    getSettings(),
    db.getAll<MediaRecord>('media'),
  ]);
  const mediaOut = await Promise.all(
    media.map(async (m) => ({ id: m.id, mime: m.mime, name: m.name, createdAt: m.createdAt, dataUrl: await blobToDataUrl(m.blob) })),
  );
  const data = {
    format: 'hlh-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    posts,
    reports,
    categories,
    favorites,
    reactions,
    settings,
    media: mediaOut,
  };
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

/** Restaure un export (remplace les données locales actuelles). */
export async function importAll(file: Blob): Promise<number> {
  const data = JSON.parse(await file.text());
  if (data?.format !== 'hlh-export') throw new Error("Ce fichier n'est pas un export HUMANISONS L'HUMAIN.");
  await resetAll();
  for (const m of data.media ?? []) {
    const blob = await (await fetch(m.dataUrl)).blob();
    await db.put('media', { id: m.id, blob, mime: m.mime, name: m.name, createdAt: m.createdAt } satisfies MediaRecord);
  }
  for (const p of data.posts ?? []) await db.put('posts', p);
  for (const r of data.reports ?? []) await db.put('reports', r);
  if (data.categories) await db.put('kv', data.categories, 'categories');
  if (data.favorites) await db.put('kv', data.favorites, 'favorites');
  if (data.reactions) await db.put('kv', data.reactions, 'reactions');
  if (data.settings) await db.put('kv', data.settings, 'settings');
  await markSeeded();
  notify();
  return (data.posts ?? []).length;
}
