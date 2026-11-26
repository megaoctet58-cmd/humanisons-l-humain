/**
 * FAUX serveur Supabase, pour les tests uniquement.
 *
 * Il imite les quelques routes utilisées par le site (REST, RPC, fichiers,
 * connexion) et exécute chaque requête dans un vrai PostgreSQL, sous le rôle
 * « anon » ou « authenticated » : ce sont donc les VRAIES règles d'accès (RLS)
 * de supabase/schema.sql qui s'appliquent.
 *
 * Utilisation : PGHOST=… PGPORT=… PGDATABASE=… node supabase/tests/fake-supabase.mjs
 * Variables : PORT (54321), ADMIN_EMAIL / ADMIN_PASSWORD (admin@test.fr / motdepasse).
 */
import http from 'node:http';
import pg from 'pg';

const PORT = Number(process.env.PORT ?? 54321);
const ANON_KEY = 'cle-anon-de-test';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@test.fr';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'motdepasse';
const pool = new pg.Pool({ user: process.env.PGUSER ?? 'postgres' });
const LOG = process.env.LOG === '1';

const TABLES = { posts: 'id', post_private: 'post_id', reports: 'id', app_kv: 'key', admins: 'user_id' };
const b64url = (s) => Buffer.from(s).toString('base64url');

function jwt(user) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp }))}.c2lnbmF0dXJl`;
}

function who(req) {
  const tok = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!tok || tok === ANON_KEY) return { role: 'anon' };
  try {
    const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
    if (p.exp * 1000 < Date.now()) return { role: 'anon' };
    return { role: 'authenticated', sub: p.sub, email: p.email };
  } catch {
    return { role: 'anon' };
  }
}

async function asUser(user, fn) {
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${user.role === 'authenticated' ? 'authenticated' : 'anon'}`);
    await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user.sub ?? '']);
    const r = await fn(c);
    await c.query('commit');
    return r;
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error(`identifiant refusé : ${s}`), { http: 400 });
  return `"${s}"`;
};

/** Filtres PostgREST simples : col=eq.valeur */
function where(params, args, alias = '') {
  const parts = [];
  for (const [k, v] of params) {
    if (['select', 'limit', 'order', 'columns', 'on_conflict'].includes(k)) continue;
    const m = /^eq\.(.*)$/.exec(v);
    if (!m) throw Object.assign(new Error(`filtre non géré : ${k}=${v}`), { http: 400 });
    args.push(m[1]);
    parts.push(`${alias}${ident(k)}::text = $${args.length}`);
  }
  return parts.length ? ` where ${parts.join(' and ')}` : '';
}

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(status, { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', ...(isBuf ? {} : { 'content-type': 'application/json' }), ...headers });
  res.end(isBuf ? body : body === undefined ? '' : JSON.stringify(body));
}

function pgError(res, e) {
  if (e.http) return send(res, e.http, { message: e.message });
  const status = e.code === '42501' ? 403 : e.code === '23505' ? 409 : e.code === 'P0001' ? 400 : 500;
  send(res, status, { code: e.code, message: e.message, details: null, hint: null });
}

async function body(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function rest(req, res, url, user) {
  const [, , , table] = url.pathname.split('/'); // /rest/v1/<table>
  const params = url.searchParams;
  if (table === 'rpc') {
    const fn = url.pathname.split('/')[4];
    const args = JSON.parse((await body(req)).toString() || '{}');
    const names = Object.keys(args);
    const sql = `select * from public.${ident(fn)}(${names.map((n, i) => `${ident(n)} => $${i + 1}`).join(', ')})`;
    const vals = names.map((n) => (typeof args[n] === 'object' && args[n] !== null ? JSON.stringify(args[n]) : args[n]));
    const r = await asUser(user, (c) => c.query(sql, vals));
    const cols = r.fields.map((f) => f.name);
    const returnsSet = cols.length > 1 || fn === 'my_contributions';
    if (returnsSet) return send(res, 200, r.rows);
    const v = r.rows[0]?.[cols[0]];
    return send(res, 200, v === undefined ? null : v);
  }
  if (!(table in TABLES)) return send(res, 404, { message: `table inconnue ${table}` });
  const t = `public.${ident(table)}`;

  if (req.method === 'GET' || req.method === 'HEAD') {
    const sel = params.get('select') ?? '*';
    const embed = /post_private\(data\)/.test(sel);
    const cols = sel
      .replace(/,?post_private\(data\)/, '')
      .split(',')
      .filter(Boolean)
      .map((c) => (c === '*' ? 'x.*' : `x.${ident(c)}`));
    if (embed) cols.push(`(select json_build_object('data', pp.data) from public.post_private pp where pp.post_id = x.id) as post_private`);
    const args = [];
    let sql = `select ${cols.join(', ')} from ${t} x${where(params, args, 'x.')}`;
    const order = params.get('order');
    if (order) {
      const [col, dir] = order.split('.');
      sql += ` order by x.${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}`;
    }
    if (params.get('limit')) sql += ` limit ${Number(params.get('limit'))}`;
    const r = await asUser(user, (c) => c.query(sql, args));
    if ((req.headers.accept ?? '').includes('vnd.pgrst.object')) {
      if (r.rows.length !== 1) return send(res, 406, { message: 'JSON object requested, multiple (or no) rows returned' });
      return send(res, 200, r.rows[0]);
    }
    return send(res, 200, r.rows);
  }

  if (req.method === 'POST') {
    const data = JSON.parse((await body(req)).toString());
    const rows = Array.isArray(data) ? data : [data];
    const pk = TABLES[table];
    const merge = (req.headers.prefer ?? '').includes('merge-duplicates');
    await asUser(user, async (c) => {
      for (const row of rows) {
        const keys = Object.keys(row);
        const vals = keys.map((k) => (typeof row[k] === 'object' && row[k] !== null ? JSON.stringify(row[k]) : row[k]));
        let sql = `insert into ${t} (${keys.map(ident).join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')})`;
        if (merge) sql += ` on conflict (${ident(pk)}) do update set ${keys.filter((k) => k !== pk).map((k) => `${ident(k)} = excluded.${ident(k)}`).join(', ')}`;
        await c.query(sql, vals);
      }
    });
    return send(res, 201, undefined);
  }

  if (req.method === 'PATCH') {
    const data = JSON.parse((await body(req)).toString());
    const keys = Object.keys(data);
    const args = keys.map((k) => (typeof data[k] === 'object' && data[k] !== null ? JSON.stringify(data[k]) : data[k]));
    const sql = `update ${t} x set ${keys.map((k, i) => `${ident(k)} = $${i + 1}`).join(', ')}${where(params, args, 'x.')}`;
    await asUser(user, (c) => c.query(sql, args));
    return send(res, 204, undefined);
  }

  if (req.method === 'DELETE') {
    const args = [];
    await asUser(user, (c) => c.query(`delete from ${t} x${where(params, args, 'x.')}`, args));
    return send(res, 204, undefined);
  }
  send(res, 405, { message: 'méthode non gérée' });
}

async function storage(req, res, url, user) {
  const rest = decodeURIComponent(url.pathname.replace(/^\/storage\/v1\/object\//, ''));
  if (req.method === 'POST' && !rest.startsWith('list')) {
    const [bucket, ...p] = rest.split('/');
    const name = p.join('/');
    const raw = await body(req);
    const form = await new Request('http://x/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: raw }).formData();
    const file = [...form.values()].find((v) => typeof v !== 'string');
    const buf = Buffer.from(await file.arrayBuffer());
    try {
      await asUser(user, (c) => c.query('insert into storage.objects (bucket_id, name, content, mime) values ($1, $2, $3, $4)', [bucket, name, buf, file.type]));
    } catch (e) {
      if (e.code === '23505') return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' });
      if (e.code === '42501') return send(res, 400, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' });
      throw e;
    }
    return send(res, 200, { Key: `${bucket}/${name}`, Id: name });
  }
  if (req.method === 'GET') {
    const [bucket, ...p] = rest.replace(/^authenticated\//, '').split('/');
    const r = await asUser(user, (c) => c.query('select content, mime from storage.objects where bucket_id = $1 and name = $2', [bucket, p.join('/')]));
    if (!r.rows.length) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
    return send(res, 200, r.rows[0].content, { 'content-type': r.rows[0].mime ?? 'application/octet-stream' });
  }
  if (req.method === 'DELETE') {
    const bucket = rest.split('/')[0];
    const { prefixes } = JSON.parse((await body(req)).toString());
    const r = await asUser(user, (c) => c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name', [bucket, prefixes]));
    return send(res, 200, r.rows.map((x) => ({ name: x.name })));
  }
  send(res, 405, { message: 'non géré' });
}

async function auth(req, res, url) {
  if (url.pathname === '/auth/v1/token') {
    const { email, password } = JSON.parse((await body(req)).toString());
    const r = await pool.query('select id, email from auth.users where email = $1', [email]);
    const ok = r.rows.length && password === (email === ADMIN_EMAIL ? ADMIN_PASSWORD : 'intrus');
    if (!ok) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials', msg: 'Invalid login credentials' });
    const user = r.rows[0];
    const now = Math.floor(Date.now() / 1000);
    return send(res, 200, {
      access_token: jwt(user),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'rt-' + user.id,
      user: { id: user.id, aud: 'authenticated', role: 'authenticated', email: user.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    });
  }
  if (url.pathname === '/auth/v1/user') {
    const u = who(req);
    if (u.role !== 'authenticated') return send(res, 401, { msg: 'invalid JWT' });
    return send(res, 200, { id: u.sub, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  }
  if (url.pathname === '/auth/v1/logout') return send(res, 204, undefined);
  send(res, 404, { msg: 'non géré' });
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
        'access-control-allow-headers': req.headers['access-control-request-headers'] ?? '*',
        'access-control-max-age': '600',
      });
      return res.end();
    }
    const user = who(req);
    if (LOG) console.log(new Date().toISOString().slice(11, 23), req.headers['user-agent']?.slice(-12), user.role, req.method, url.pathname + url.search);
    try {
      if (url.pathname.startsWith('/rest/v1/')) return await rest(req, res, url, user);
      if (url.pathname.startsWith('/storage/v1/object')) return await storage(req, res, url, user);
      if (url.pathname.startsWith('/auth/v1/')) return await auth(req, res, url);
      send(res, 404, { message: 'route inconnue' });
    } catch (e) {
      if (LOG) console.log('  →', e.code, e.message);
      pgError(res, e);
    }
  })
  .listen(PORT, () => console.log(`Faux Supabase prêt sur http://localhost:${PORT}`));
