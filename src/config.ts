/**
 * Connexion à la base partagée (Supabase).
 *
 * Tant que ces deux valeurs sont vides, le site fonctionne comme le prototype
 * V0.1 : tout reste dans le navigateur de chaque appareil.
 *
 * Dès qu'elles sont remplies, publications, contributions et fichiers sont
 * partagés entre tous les appareils.
 *
 * ⚠ Seule la clé PUBLIQUE (« anon » / « publishable ») a sa place ici : elle est
 * faite pour être visible dans un site web, la sécurité repose sur les règles
 * d'accès (RLS) de supabase/schema.sql. Ne mettez JAMAIS ici la clé secrète
 * (« service_role » / « secret »).
 */
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

/** true : base partagée ; false : stockage local du navigateur uniquement. */
export const REMOTE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && import.meta.env.VITE_FORCE_LOCAL !== '1';
