/**
 * Test des COMPTES CONTRIBUTEURS (facultatifs) avec la base partagée.
 *
 * Téléphone A : sans compte, met un favori, écrit un brouillon et envoie une contribution,
 *   puis crée un compte : tout est rattaché au compte.
 * Ordinateur B : se connecte au même compte et retrouve tout (contribution, brouillon,
 *   favori), termine le brouillon, en écrit un autre avec une image.
 * Visiteur C : ne voit aucun brouillon. Enfin, suppression du compte.
 *
 * Tourne contre le faux Supabase (voir supabase/tests/README.md).
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4174/';
const API = process.env.API_URL ?? 'http://localhost:54321';
const ANON = 'cle-anon-de-test';
const STAMP = Date.now();
const EMAIL = `alice${STAMP}@test.fr`;
const PASSWORD = 'motdepasse-alice';
const SENT = `Envoyé sans compte ${STAMP}`;
const DRAFT = `Brouillon du téléphone ${STAMP}`;
const DRAFT2 = `Brouillon de l’ordinateur ${STAMP}`;
let step = 0;
const ok = (msg) => console.log(`✔ ${String(++step).padStart(2, '0')}. ${msg}`);
const fail = (msg) => {
  throw new Error(`✘ Étape ${step + 1} : ${msg}`);
};
// 1×1 pixel PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==', 'base64');

const browser = await chromium.launch();
const device = async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
};
const go = async (page, hash) => {
  if (page.url().endsWith(`#${hash}`)) await page.goto(`${BASE}#/a-propos`);
  await page.waitForTimeout(3200); // le site relit la base au plus toutes les 3 s en changeant de page
  await page.goto(`${BASE}#${hash}`);
};
const A = await device();
const B = await device();

try {
  // 1. Téléphone A, sans compte : favori + brouillon + contribution envoyée
  await A.goto(BASE);
  const firstCard = A.getByTestId('post-card').first();
  await firstCard.waitFor();
  const favTitle = (await firstCard.locator('h2, h3').first().textContent())?.trim();
  await firstCard.getByRole('button', { name: 'Ajouter aux favoris' }).click();
  await A.getByText('Ajouté à vos favoris.').waitFor();

  await A.goto(`${BASE}#/temoigner`);
  await A.locator('label.segmented__opt', { hasText: 'Écrire' }).click();
  await A.getByTestId('field-title').fill(DRAFT);
  await A.getByTestId('field-text').fill('Commencé sur le téléphone.');
  await A.getByTestId('save-draft').click();
  await A.getByText('Brouillon enregistré sur cet appareil.').waitFor();

  await go(A, '/temoigner?nouveau=1');
  await A.locator('label.segmented__opt', { hasText: 'Écrire' }).click();
  await A.getByTestId('field-title').fill(SENT);
  await A.getByTestId('field-text').fill('Envoyé avant de créer un compte.');
  await A.getByTestId('consent-publication').check();
  await A.getByTestId('submit-moderation').click();
  await A.getByTestId('submit-confirmation').waitFor({ timeout: 15000 }).catch(async () => fail(`envoi : ${await A.locator('#form-errors').textContent().catch(() => '?')}`));
  ok(`Téléphone A sans compte : favori (« ${favTitle?.slice(0, 30)} »), brouillon et contribution`);

  // 2. Création du compte sur le téléphone A
  await go(A, '/mon-espace');
  await A.getByTestId('account-open-signup').click();
  await A.getByTestId('account-email').fill(EMAIL);
  await A.getByTestId('account-password').fill('court');
  if (await A.getByTestId('account-password').evaluate((el) => el.checkValidity())) fail('mot de passe trop court accepté');
  await A.getByTestId('account-password').fill(PASSWORD);
  await A.getByTestId('account-submit').click();
  await A.getByTestId('account-connected').waitFor({ timeout: 10000 }).catch(async () => fail(`création : ${await A.getByTestId('account-error').textContent().catch(() => '?')}`));
  ok('Téléphone A : compte créé (mot de passe trop court refusé d’abord)');

  // 3. Ordinateur B : connexion, tout est là
  await B.goto(`${BASE}#/mon-espace`);
  await B.getByTestId('account-open-login').click();
  await B.getByTestId('account-email').fill(EMAIL);
  await B.getByTestId('account-password').fill(PASSWORD);
  await B.getByTestId('account-submit').click();
  await B.getByTestId('account-connected').waitFor({ timeout: 10000 });
  await B.getByTestId('my-contributions').getByText(SENT).waitFor({ timeout: 10000 }).catch(() => fail('contribution du téléphone absente sur l’ordinateur'));
  await B.getByRole('tab', { name: /Brouillons/ }).click();
  await B.getByText(DRAFT).waitFor().catch(() => fail('brouillon du téléphone absent'));
  await B.getByRole('tab', { name: /Favoris/ }).click();
  await B.getByTestId('post-card').first().waitFor().catch(() => fail('favori du téléphone absent'));
  ok('Ordinateur B : contribution, brouillon et favori du téléphone retrouvés');

  // 4. B termine le brouillon du téléphone et l'envoie
  await B.getByRole('tab', { name: /Brouillons/ }).click();
  await B.locator('li', { hasText: DRAFT }).getByRole('button', { name: 'Reprendre' }).click();
  await B.getByTestId('field-text').fill('Commencé sur le téléphone, terminé sur l’ordinateur.');
  await B.getByTestId('consent-publication').check();
  await B.getByTestId('submit-moderation').click();
  await B.getByTestId('submit-confirmation').waitFor({ timeout: 15000 }).catch(async () => fail(`envoi du brouillon : ${await B.locator('#form-errors').textContent().catch(() => '?')}`));
  ok('Ordinateur B : brouillon du téléphone terminé et envoyé à la modération');

  // 5. B écrit un nouveau brouillon avec une image
  await go(B, '/temoigner?nouveau=2');
  await B.locator('label.segmented__opt', { hasText: 'Écrire' }).click();
  await B.getByTestId('field-title').fill(DRAFT2);
  await B.getByTestId('field-text').fill('Avec une image.');
  await B.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: PNG });
  await B.getByTestId('save-draft').click();
  await B.getByText('Brouillon enregistré (sur cet appareil et dans votre compte).').waitFor();
  ok('Ordinateur B : nouveau brouillon avec image enregistré dans le compte');

  // 6. Retour sur le téléphone A : tout est à jour
  await go(A, '/mon-espace');
  const mine = A.getByTestId('my-contributions');
  await mine.getByText(DRAFT).waitFor({ timeout: 10000 }).catch(() => fail('le brouillon envoyé depuis B n’apparaît pas dans les contributions de A'));
  await A.getByRole('tab', { name: /Brouillons/ }).click();
  if (await A.getByText(DRAFT, { exact: true }).count()) fail('le brouillon envoyé est encore dans les brouillons de A');
  await A.locator('li', { hasText: DRAFT2 }).getByRole('button', { name: 'Reprendre' }).click();
  await A.locator('img[src^="blob:"]').first().waitFor({ timeout: 10000 }).catch(() => fail('image du brouillon non chargée sur le téléphone'));
  ok('Téléphone A : contribution envoyée depuis B visible, brouillon de B repris avec son image');

  // 7. Le public ne voit aucun brouillon ni aucune donnée de compte
  const h = { apikey: ANON, authorization: `Bearer ${ANON}` };
  for (const t of ['drafts', 'user_data']) {
    const r = await fetch(`${API}/rest/v1/${t}?select=*`, { headers: h });
    if (r.status < 400 && (await r.text()) !== '[]') fail(`table ${t} lisible publiquement`);
  }
  ok('Visiteur : brouillons et données de compte illisibles');

  // 8. Suppression du compte depuis B
  await go(B, '/mon-espace');
  await B.getByRole('tab', { name: 'Profil' }).click();
  await B.getByTestId('account-delete').click();
  await B.getByTestId('account-delete-confirm').click();
  await B.getByText('Compte supprimé.').waitFor({ timeout: 10000 });
  await B.getByTestId('account-open-login').click();
  await B.getByTestId('account-email').fill(EMAIL);
  await B.getByTestId('account-password').fill(PASSWORD);
  await B.getByTestId('account-submit').click();
  await B.getByTestId('account-error').waitFor();
  ok('Suppression du compte : la connexion n’est plus possible');

  for (const p of [A, B]) if (p.errors.length) fail(`erreurs JavaScript : ${p.errors.join(' | ')}`);
  console.log('\nTest des comptes : OK');
} catch (e) {
  console.error(e.message);
  await A.screenshot({ path: '/tmp/comptes-A.png' }).catch(() => {});
  await B.screenshot({ path: '/tmp/comptes-B.png' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
