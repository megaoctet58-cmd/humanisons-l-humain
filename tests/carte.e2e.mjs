/**
 * Test de la CARTE DES DÉPARTEMENTS avec la base partagée (faux Supabase, vraies règles d'accès).
 *
 *  1. Un contributeur indique son département (Nièvre) : il part dans les données privées.
 *  2. Tant que la Nièvre compte moins de 3 témoignages publiés : « moins de 3 », aucune liste.
 *  3. À 3 : le nombre s'affiche et la liste des 3 témoignages est proposée.
 *  4. Le département n'apparaît nulle part sur le témoignage, ni dans ses données publiques.
 *
 * Lancement : comme tests/partage.e2e.mjs (voir supabase/tests/README.md), puis
 *   PGDATABASE=hlh_e2e node tests/carte.e2e.mjs
 * Variables : SHOTS=dossier pour des captures.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const pg = require('pg');

const BASE = process.env.BASE_URL ?? 'http://localhost:4174/';
const API = process.env.API_URL ?? 'http://localhost:54321';
const ANON = 'cle-anon-de-test';
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const STAMP = Date.now();
const TITLE = `Carte ${STAMP}`;
let step = 0;
const ok = (msg) => console.log(`✔ ${String(++step).padStart(2, '0')}. ${msg}`);
const fail = (msg) => {
  throw new Error(`✘ Étape ${step + 1} : ${msg}`);
};

const db = new pg.Client();
await db.connect();
const browser = await chromium.launch();

async function seed(id, title, department) {
  const data = { type: 'temoignage', title, categoryId: 'c1', text: 'Témoignage de test.', anonymous: true, images: [], sources: [], verification: 'non_verifie', consent: { publication: true, voiceIdentifiable: false }, createdAt: new Date().toISOString() };
  await db.query(`insert into public.posts (id, status, data, published_at) values ($1, 'publie', $2, now())`, [id, data]);
  await db.query(`insert into public.post_private (post_id, data) values ($1, $2)`, [id, { department }]);
}

try {
  // 1. Le contributeur indique la Nièvre
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const c = await ctx.newPage();
  await c.goto(`${BASE}#/temoigner`);
  await c.locator('label.segmented__opt', { hasText: 'Écrire' }).click();
  await c.getByTestId('field-title').fill(TITLE);
  await c.getByTestId('field-text').fill('Témoignage envoyé avec un département.');
  await c.getByTestId('field-department').selectOption('58');
  await c.getByTestId('consent-publication').check();
  await c.getByTestId('submit-moderation').click();
  await c.getByTestId('submit-confirmation').waitFor({ timeout: 15000 }).catch(async () => fail(`envoi échoué : ${await c.locator('#form-errors').textContent().catch(() => '?')}`));
  const { rows } = await db.query(`select p.id, p.data, pp.data as priv from public.posts p join public.post_private pp on pp.post_id = p.id where p.data->>'title' = $1`, [TITLE]);
  if (rows.length !== 1) fail('contribution introuvable');
  const id = rows[0].id;
  if (rows[0].priv.department !== '58') fail(`département non enregistré (${JSON.stringify(rows[0].priv)})`);
  if (JSON.stringify(rows[0].data).includes('58') && 'department' in rows[0].data) fail('département dans les données publiques');
  ok('Contributeur : département « 58 » enregistré dans les données privées seulement');

  // 2. Publié, plus un autre : 2 en Nièvre → « moins de 3 »
  await db.query(`update public.posts set status = 'publie', published_at = now() where id = $1`, [id]);
  await seed(`carte_a_${STAMP}`, `Carte A ${STAMP}`, '58');
  const v = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  v.on('pageerror', (e) => errors.push(e.message));
  await v.goto(`${BASE}#/explorer`);
  await v.getByTestId('tab-map').click();
  await v.getByTestId('department-map').waitFor();
  await v.getByTestId('map-select').selectOption('58');
  await v.getByTestId('map-info').getByText('moins de 3 témoignages').waitFor({ timeout: 8000 }).catch(async () => fail(`attendu « moins de 3 » : ${await v.getByTestId('map-info').textContent()}`));
  if (await v.getByText(TITLE).count()) fail('liste affichée sous 3');
  ok('Visiteur : 2 témoignages en Nièvre → « moins de 3 », aucune liste');

  // 3. Un troisième : le nombre et la liste apparaissent (clic sur la carte)
  await seed(`carte_b_${STAMP}`, `Carte B ${STAMP}`, '58');
  await seed(`carte_c_${STAMP}`, `Carte C ${STAMP}`, '13');
  for (let i = 0; i < 3; i++) await seed(`carte_p${i}_${STAMP}`, `Paris ${i} ${STAMP}`, '75');
  await v.goto(`${BASE}#/explorer?vue=carte`);
  await v.reload();
  await v.locator('path[data-code="58"]').click();
  await v.getByTestId('map-info').getByText('3 témoignages').waitFor({ timeout: 8000 }).catch(async () => fail(`attendu « 3 témoignages » : ${await v.getByTestId('map-info').textContent()}`));
  await v.getByText(TITLE).waitFor();
  await v.getByText(`Carte A ${STAMP}`).waitFor();
  await v.getByText(`Carte B ${STAMP}`).waitFor();
  if (await v.getByText(`Carte C ${STAMP}`).count()) fail('un témoignage d’un autre département est listé');
  const fill58 = await v.locator('path[data-code="58"]').evaluate((e) => getComputedStyle(e).fill);
  const fill01 = await v.locator('path[data-code="01"]').evaluate((e) => getComputedStyle(e).fill);
  if (fill58 === fill01) fail('la Nièvre n’est pas colorée');
  if (SHOTS) await v.screenshot({ path: `${SHOTS}/carte-telephone.png`, fullPage: true });
  ok('Visiteur : 3 en Nièvre → « 3 témoignages », la Nièvre est colorée et ses 3 témoignages sont listés');

  // 4. Le département n'est visible nulle part sur la publication, ni par la clé publique
  await v.goto(`${BASE}#/publication/${id}`);
  await v.getByText(TITLE).first().waitFor();
  const body = await v.locator('main').textContent();
  if (/Nièvre|\b58\b/.test(body ?? '')) fail('département visible sur la publication');
  const r = await fetch(`${API}/rest/v1/posts?select=*`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } });
  if ((await r.text()).includes('department')) fail('département lisible avec la clé publique');
  ok('Publication : département invisible, absent des données publiques');

  if (SHOTS) {
    const d = await (await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' })).newPage();
    await d.goto(`${BASE}#/explorer?vue=carte&dep=75`);
    await d.getByTestId('map-info').getByText('3 témoignages').waitFor({ timeout: 8000 });
    await d.screenshot({ path: `${SHOTS}/carte-ordinateur-sombre.png`, fullPage: true });
  }
  if (errors.length) fail(`erreurs JavaScript : ${errors.join(' | ')}`);
  console.log('\nTest de la carte : OK');
} finally {
  await browser.close();
  await db.end();
}
