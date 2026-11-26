/**
 * Test « PLUSIEURS APPAREILS » avec la base partagée.
 *
 * Trois navigateurs séparés (= trois appareils, aucune donnée locale en commun) :
 *   - le téléphone d'un contributeur, qui envoie un témoignage vocal ;
 *   - un visiteur, qui ne doit RIEN voir avant validation, puis tout voir après ;
 *   - le téléphone de l'administrateur, qui se connecte, écoute, valide, et
 *     transfère une ancienne publication restée sur son appareil (V0.1).
 *
 * Il tourne contre le faux Supabase (supabase/tests/fake-supabase.mjs), qui
 * applique les vraies règles d'accès de supabase/schema.sql dans PostgreSQL.
 * Voir supabase/tests/README.md pour le lancer.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4174/';
const API = process.env.API_URL ?? 'http://localhost:54321';
const ANON = 'cle-anon-de-test';
const TITLE = `Partage ${Date.now()}`;
const OLD_TITLE = `Ancien témoignage V0.1 ${Date.now()}`;
let step = 0;
const ok = (msg) => console.log(`✔ ${String(++step).padStart(2, '0')}. ${msg}`);
const fail = (msg) => {
  throw new Error(`✘ Étape ${step + 1} : ${msg}`);
};

/** Ce que n'importe qui sur Internet obtient avec la clé publique. */
async function anonGet(path) {
  const r = await fetch(`${API}${path}`, { headers: { apikey: ANON, authorization: `Bearer ${ANON}` } });
  return { status: r.status, text: await r.text() };
}

async function playback(page, container, label) {
  await container.getByTestId('play-button').click();
  const time = container.getByTestId('player-time');
  await page.waitForFunction((el) => !/^0:00\s/.test(el.textContent ?? ''), await time.elementHandle(), { timeout: 10000 }).catch(() => fail(`${label} : la lecture ne progresse pas`));
  await container.getByTestId('play-button').click();
}

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const device = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return { ctx, page };
};
const contributor = await device();
const visitor = await device();
const admin = await device();

try {
  // 1. Le contributeur envoie un témoignage vocal depuis son téléphone
  const c = contributor.page;
  await c.goto(`${BASE}#/temoigner`);
  await c.getByTestId('field-title').fill(TITLE);
  await c.getByTestId('field-text').fill('Témoignage envoyé depuis le téléphone A.');
  await c.getByTestId('rec-start').click();
  await c.getByTestId('rec-stop').waitFor({ timeout: 8000 });
  await c.waitForTimeout(2500);
  await c.getByTestId('rec-stop').click();
  await c.getByTestId('recording-preview').waitFor({ timeout: 10000 });
  await c.getByTestId('field-transcription').fill('Transcription.');
  await c.getByTestId('consent-publication').check();
  await c.getByTestId('consent-voice').check();
  await c.getByTestId('consent-third-party').check();
  await c.getByTestId('submit-moderation').click();
  await c.getByTestId('submit-confirmation').waitFor({ timeout: 15000 }).catch(async () => fail(`envoi échoué : ${await c.locator('#form-errors').textContent().catch(() => '?')}`));
  ok('Téléphone A : témoignage vocal envoyé à la modération');

  // 2. Personne d'autre ne peut le lire avant validation
  const v = visitor.page;
  await v.goto(BASE);
  await v.getByTestId('feed-end').waitFor();
  if (await v.getByText(TITLE).count()) fail('visible dans le fil avant modération');
  const raw = await anonGet('/rest/v1/posts?select=*');
  if (raw.text.includes(TITLE)) fail('lisible par la clé publique avant modération');
  const priv = await anonGet('/rest/v1/post_private?select=*');
  if (priv.status < 400) fail(`données privées lisibles publiquement (${priv.status} ${priv.text})`);
  ok('Visiteur : rien de visible avant validation (fil, accès direct à la base, données privées)');

  // 3. L'admin doit se connecter ; un mauvais mot de passe est refusé
  const a = admin.page;
  await a.goto(`${BASE}#/admin`);
  await a.getByTestId('admin-login').waitFor();
  await a.getByTestId('login-email').fill('admin@test.fr');
  await a.getByTestId('login-password').fill('mauvais');
  await a.getByTestId('login-submit').click();
  await a.getByText('Adresse e-mail ou mot de passe incorrect.').waitFor();
  ok('Administration : connexion exigée, mauvais mot de passe refusé');

  // 4. Un compte connecté mais non administrateur n'a aucun droit
  await a.getByTestId('login-email').fill('intrus@test.fr');
  await a.getByTestId('login-password').fill('intrus');
  await a.getByTestId('login-submit').click();
  await a.getByText('n’a pas les droits d’administration').first().waitFor();
  await a.getByRole('button', { name: 'Se déconnecter' }).click();
  await a.getByTestId('login-email').waitFor();
  ok('Administration : compte non administrateur refusé');

  // 5. Ancienne publication restée sur le téléphone de l'admin (V0.1) : on l'y dépose
  await a.evaluate(
    (title) =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('hlh', 1);
        r.onsuccess = () => {
          const db = r.result;
          const now = new Date().toISOString();
          const tx = db.transaction(['posts', 'media'], 'readwrite');
          tx.objectStore('media').put({ id: 'm_ancienne_image', blob: new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/svg+xml' }), mime: 'image/svg+xml', createdAt: now });
          tx.objectStore('posts').put({
            id: 'p_ancien_v01', type: 'temoignage', title, categoryId: 'cat_1', text: 'Validé sur le téléphone avec la V0.1.', anonymous: false, authorName: 'Jérémy',
            images: [{ id: 'm_ancienne_image', mime: 'image/svg+xml', size: 41 }], sources: [], verification: 'non_verifie', status: 'publie', mine: true,
            consent: { publication: true, voiceIdentifiable: true }, createdAt: now, updatedAt: now, publishedAt: now, private: { email: 'ancien@test.fr' },
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        r.onerror = () => reject(r.error);
      }),
    OLD_TITLE,
  );

  // 6. Connexion administrateur
  await a.getByTestId('login-email').fill('admin@test.fr');
  await a.getByTestId('login-password').fill('motdepasse');
  await a.getByTestId('login-submit').click();
  await a.getByTestId('admin').waitFor();
  ok('Téléphone admin : connexion réussie');

  // 7. Il voit et écoute la contribution venue du téléphone A, avec l'e-mail privé
  await a.goto(`${BASE}#/admin/contributions`);
  await a.getByTestId('admin-item').filter({ hasText: TITLE }).click();
  const review = a.getByTestId('review-panel');
  await review.waitFor();
  await playback(a, review, 'administration');
  ok("Téléphone admin : contribution du téléphone A reçue et écoutée (fichier audio téléchargé depuis la base)");

  // Demande de précisions → le contributeur complète depuis son téléphone
  await review.getByLabel('Message à l’auteur (précisions, modifications proposées)').fill('Pouvez-vous préciser la date ?');
  await review.getByRole('button', { name: 'Demander des précisions' }).click();
  await a.getByText('Demande de précisions enregistrée.').first().waitFor();
  await c.waitForTimeout(3500); // le site relit la base au plus toutes les 3 s en changeant de page
  await c.goto(`${BASE}#/mon-espace`);
  await c.getByText('Pouvez-vous préciser la date ?').waitFor({ timeout: 10000 });
  await c.getByTestId('my-contributions').locator('li', { hasText: TITLE }).getByRole('button', { name: 'Compléter' }).click();
  await c.getByTestId('field-text').fill('Témoignage envoyé depuis le téléphone A. C’était en mars.');
  await c.getByTestId('consent-publication').check();
  await c.getByTestId('consent-voice').check();
  await c.getByTestId('consent-third-party').check();
  await c.getByTestId('submit-moderation').click();
  await c.getByTestId('submit-confirmation').waitFor({ timeout: 15000 }).catch(async () => fail(`complément échoué : ${await c.locator('#form-errors').textContent().catch(() => '?')}`));
  await a.goto(`${BASE}#/admin/contributions`);
  await a.getByTestId('admin-item').filter({ hasText: TITLE }).click();
  await review.getByText('C’était en mars.').waitFor({ timeout: 10000 });
  ok('Demande de précisions : message reçu sur le téléphone A, contribution complétée, reçue par l’admin');

  // 8. Validation
  await a.getByTestId('approve-publish').click();
  await a.getByText('Publié dans le fil.').first().waitFor();
  ok('Téléphone admin : contribution validée');

  // 9. Transfert de l'ancienne publication V0.1
  await a.goto(`${BASE}#/admin/parametres`);
  const transfer = a.getByTestId('local-transfer');
  await transfer.waitFor();
  await transfer.getByRole('button', { name: /Envoyer vers la base partagée/ }).click();
  await a.getByText('1 élément(s) envoyé(s)').waitFor({ timeout: 15000 });
  ok("Téléphone admin : ancienne publication V0.1 envoyée dans la base partagée");

  // 10. Le visiteur (autre appareil) voit les deux et écoute la voix
  await v.reload();
  const card = v.getByTestId('post-card').filter({ hasText: TITLE });
  await card.waitFor({ timeout: 10000 });
  await v.getByTestId('post-card').filter({ hasText: OLD_TITLE }).waitFor();
  await v.getByTestId('post-card').filter({ hasText: OLD_TITLE }).locator('img').first().waitFor();
  await playback(v, card, 'visiteur');
  ok('Visiteur : les deux publications apparaissent sur son appareil, la voix se lit, l’image s’affiche');

  // 11. Les données privées restent privées même après publication
  const after = await anonGet('/rest/v1/posts?select=*');
  if (after.text.includes('ancien@test.fr')) fail("l'e-mail privé est lisible publiquement");
  ok("Après publication : l'e-mail privé n'est toujours pas lisible publiquement");

  // 12. Le contributeur voit le nouveau statut dans « Mon espace »
  await c.waitForTimeout(3500);
  await c.goto(`${BASE}#/mon-espace`);
  const mine = c.getByTestId('my-contributions');
  await mine.getByText(TITLE).waitFor();
  await mine.locator('li', { hasText: TITLE }).getByText('Publié').waitFor({ timeout: 10000 }).catch(async () => fail(`statut affiché : ${await mine.locator('li', { hasText: TITLE }).textContent()}`));
  ok('Téléphone A : « Mon espace » affiche « Publié »');

  // Publication directe du fondateur, visible sur un autre appareil
  const FOUNDER = `Mot du fondateur ${Date.now()}`;
  await a.goto(`${BASE}#/temoigner?mode=fondateur`);
  await a.getByTestId('field-title').fill(FOUNDER);
  await a.getByTestId('field-text').fill('Publié directement par le fondateur.');
  await a.locator('label.segmented__opt', { hasText: 'Écrire' }).click();
  await a.getByRole('button', { name: 'Publier dans le fil' }).evaluate((el) => el.click()); // (le mini-lecteur fixe recouvre le bas de l'écran)
  await a.getByText('Publication mise en ligne dans le fil.').waitFor({ timeout: 15000 }).catch(async () => fail(`publication fondateur : ${await a.locator('#form-errors').textContent().catch(() => '?')}`));
  await v.waitForTimeout(3500);
  await v.goto(`${BASE}#/a-propos`);
  await v.goto(`${BASE}#/`);
  await v.getByTestId('post-card').filter({ hasText: FOUNDER }).waitFor({ timeout: 10000 });
  ok('Fondateur : publication directe visible sur l’appareil du visiteur');

  // 13. Déconnexion : l'administration se referme
  await a.goto(`${BASE}#/admin`);
  await a.getByTestId('logout').click();
  await a.getByTestId('admin-login').waitFor();
  ok("Téléphone admin : après déconnexion, l'administration est refermée");

  for (const d of [contributor, visitor, admin]) if (d.page.errors.length) fail(`erreurs JavaScript : ${d.page.errors.join(' | ')}`);
  console.log('\nTest plusieurs appareils : OK');
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
