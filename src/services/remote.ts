/**
 * Accès à la base PARTAGÉE (Supabase : PostgreSQL + stockage de fichiers + connexion).
 *
 * Les règles de sécurité ne sont pas ici mais dans la base (supabase/schema.sql) :
 * ce fichier ne peut rien lire de plus que ce que la base autorise.
 * L'interface n'appelle jamais ce module directement : elle passe par repository.ts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import type { Category, Post, PostStatus, PrivateInfo, Report, Settings } from '../models/types';

const BUCKET = 'media';

let clientPromise: Promise<SupabaseClient> | null = null;

/** Le client n'est chargé que si la base partagée est configurée. */
export function client(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hlh-auth' },
      }),
    );
  }
  return clientPromise;
}

/** Message d'erreur compréhensible. */
function fail(context: string, error: { message?: string } | null | undefined): never {
  const msg = error?.message ?? 'erreur inconnue';
  if (/fetch|network|Failed to|Load failed|NetworkError/i.test(msg)) {
    throw new Error(`${context} : la base partagée ne répond pas. Vérifiez votre connexion et réessayez dans un instant.`);
  }
  throw new Error(`${context} : ${msg}`);
}

/* ------------------------------------------------------------------ */
/* Conversion publication ⇄ lignes de la base                          */
/* ------------------------------------------------------------------ */

interface PostRow {
  id: string;
  status: PostStatus;
  data: Partial<Post>;
  published_at: string | null;
  scheduled_at: string | null;
  created_at?: string;
  updated_at: string | null;
  post_private?: { data: PrivateInfo } | { data: PrivateInfo }[] | null;
}

const iso = (x?: string | null) => (x ? new Date(x).toISOString() : undefined);

export function fromRow(r: PostRow, priv?: PrivateInfo): Post {
  const d = r.data ?? {};
  const p = {
    ...d,
    id: r.id,
    status: r.status,
    images: d.images ?? [],
    sources: d.sources ?? [],
    anonymous: Boolean(d.anonymous),
    consent: d.consent ?? { publication: true, voiceIdentifiable: false },
    verification: d.verification ?? 'non_verifie',
    publishedAt: iso(r.published_at),
    scheduledAt: iso(r.scheduled_at),
    createdAt: d.createdAt ?? iso(r.created_at) ?? new Date().toISOString(),
    updatedAt: iso(r.updated_at) ?? d.updatedAt ?? new Date().toISOString(),
    private: priv ?? {},
  } as Post;
  if (p.anonymous && priv?.hiddenAuthorName) p.authorName = priv.hiddenAuthorName;
  return p;
}

/** Sépare la partie publique et la partie privée d'une publication. */
export function split(post: Post): { data: Record<string, unknown>; priv: PrivateInfo } {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { private: priv, mine, status, publishedAt, scheduledAt, id, ...rest } = post;
  const data: Record<string, unknown> = { ...rest };
  const privOut: PrivateInfo = { ...priv };
  delete privOut.ownerToken;
  if (post.anonymous) {
    if (post.authorName) privOut.hiddenAuthorName = post.authorName;
    delete data.authorName;
  }
  // JSON : retire les champs « undefined ».
  return { data: JSON.parse(JSON.stringify(data)), priv: JSON.parse(JSON.stringify(privOut)) };
}

const one = <T,>(x: T | T[] | null | undefined): T | undefined => (Array.isArray(x) ? x[0] : (x ?? undefined));

/* ------------------------------------------------------------------ */
/* Lecture                                                              */
/* ------------------------------------------------------------------ */

const COLS = 'id,status,data,published_at,scheduled_at,created_at,updated_at';

/** Ce que la base autorise : publications publiques (visiteur) ou tout (admin). */
export async function listPosts(withPrivate: boolean): Promise<Post[]> {
  const sb = await client();
  const { data, error } = await sb.from('posts').select(withPrivate ? `${COLS},post_private(data)` : COLS).limit(5000);
  if (error) fail('Lecture des publications', error);
  return ((data ?? []) as unknown as PostRow[]).map((r) => fromRow(r, withPrivate ? one(r.post_private)?.data : undefined));
}

export interface Tracked {
  id: string;
  status: PostStatus;
  data: Partial<Post>;
  published_at: string | null;
  scheduled_at: string | null;
  updated_at: string | null;
  message_to_author: string | null;
  withdrawal_requested: boolean;
}

/** Statut des contributions envoyées depuis cet appareil (grâce à leur jeton). */
export async function myContributions(items: { id: string; token: string }[]): Promise<Tracked[]> {
  if (!items.length) return [];
  const sb = await client();
  const { data, error } = await sb.rpc('my_contributions', { p_items: items });
  if (error) fail('Suivi des contributions', error);
  return (data ?? []) as Tracked[];
}

/* ------------------------------------------------------------------ */
/* Contributeur (sans compte)                                          */
/* ------------------------------------------------------------------ */

export async function submitContribution(post: Post, token: string): Promise<void> {
  const sb = await client();
  const { data, priv } = split(post);
  const { error } = await sb.rpc('submit_contribution', { p_id: post.id, p_data: data, p_private: { email: priv.email, proofs: priv.proofs ?? [] }, p_token: token });
  if (error) fail('Envoi de la contribution', error);
}

export async function requestWithdrawal(id: string, token: string, reason?: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.rpc('request_withdrawal', { p_id: id, p_token: token, p_reason: reason ?? '' });
  if (error) fail('Demande de retrait', error);
}

export async function reportPost(postId: string, reason: string, details?: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.rpc('report_post', { p_post_id: postId, p_reason: reason, p_details: details ?? '' });
  if (error) fail('Signalement', error);
}

/* ------------------------------------------------------------------ */
/* Administration                                                       */
/* ------------------------------------------------------------------ */

export async function upsertPost(post: Post): Promise<Post> {
  const sb = await client();
  const { data, priv } = split(post);
  const now = new Date().toISOString();
  const { error } = await sb.from('posts').upsert({
    id: post.id,
    status: post.status,
    data,
    published_at: post.publishedAt ?? null,
    scheduled_at: post.scheduledAt ?? null,
    updated_at: now,
  });
  if (error) fail('Enregistrement de la publication', error);
  const { error: e2 } = await sb.from('post_private').upsert({ post_id: post.id, data: priv });
  if (e2) fail('Enregistrement des informations privées', e2);
  return { ...post, updatedAt: now };
}

export async function deletePost(id: string, mediaIds: string[]): Promise<void> {
  const sb = await client();
  const { error } = await sb.from('posts').delete().eq('id', id);
  if (error) fail('Suppression', error);
  if (mediaIds.length) await sb.storage.from(BUCKET).remove(mediaIds);
}

export async function listReports(): Promise<Report[]> {
  const sb = await client();
  const { data, error } = await sb.from('reports').select('id,post_id,reason,details,status,created_at').order('created_at', { ascending: false });
  if (error) fail('Lecture des signalements', error);
  return (data ?? []).map((r) => ({ id: r.id, postId: r.post_id, reason: r.reason, details: r.details ?? undefined, status: r.status, createdAt: new Date(r.created_at).toISOString() }));
}

export async function saveReport(r: Report): Promise<void> {
  const sb = await client();
  const { error } = await sb.from('reports').update({ status: r.status }).eq('id', r.id);
  if (error) fail('Signalement', error);
}

/* ------------------------------------------------------------------ */
/* Petites valeurs publiques : catégories, paramètres                  */
/* ------------------------------------------------------------------ */

export async function getKv<T>(key: 'categories' | 'settings'): Promise<T | undefined> {
  const sb = await client();
  const { data, error } = await sb.from('app_kv').select('value').eq('key', key).maybeSingle();
  if (error) fail('Lecture des paramètres', error);
  return (data?.value as T | undefined) ?? undefined;
}

export async function setKv(key: 'categories' | 'settings', value: Category[] | Settings): Promise<void> {
  const sb = await client();
  const { error } = await sb.from('app_kv').upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) fail('Enregistrement des paramètres', error);
}

/* ------------------------------------------------------------------ */
/* Fichiers                                                             */
/* ------------------------------------------------------------------ */

export async function uploadMedia(id: string, blob: Blob): Promise<void> {
  const sb = await client();
  const { error } = await sb.storage.from(BUCKET).upload(id, blob, { contentType: blob.type || 'application/octet-stream', upsert: false });
  if (error && !/exist|duplicate|409/i.test(`${error.message} ${(error as { statusCode?: string }).statusCode ?? ''}`)) fail('Envoi d’un fichier', error);
}

export async function downloadMedia(id: string): Promise<Blob | undefined> {
  const sb = await client();
  const { data, error } = await sb.storage.from(BUCKET).download(id);
  if (error) return undefined;
  return data ?? undefined;
}

export async function removeMedia(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const sb = await client();
  await sb.storage.from(BUCKET).remove(ids);
}

/* ------------------------------------------------------------------ */
/* Connexion                                                            */
/* ------------------------------------------------------------------ */

export interface AuthState {
  email?: string;
  isAdmin: boolean;
}

export async function authState(): Promise<AuthState> {
  const sb = await client();
  const { data } = await sb.auth.getSession();
  const email = data.session?.user.email;
  if (!data.session) return { isAdmin: false };
  const { data: admin, error } = await sb.rpc('is_admin');
  return { email, isAdmin: !error && admin === true };
}

export async function signIn(email: string, password: string): Promise<void> {
  const sb = await client();
  const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login|credentials/i.test(error.message)) throw new Error('Adresse e-mail ou mot de passe incorrect.');
    fail('Connexion', error);
  }
}

export async function signOut(): Promise<void> {
  const sb = await client();
  await sb.auth.signOut();
}

export async function onAuthChange(cb: () => void): Promise<() => void> {
  const sb = await client();
  const { data } = sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') cb();
  });
  return () => data.subscription.unsubscribe();
}
