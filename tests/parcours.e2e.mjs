/**
 * Test automatisé du PARCOURS PRIORITAIRE (14 étapes) avec un vrai navigateur.
 *
 * Le micro est simulé par Chromium (--use-fake-device-for-media-stream) : il
 * produit un vrai flux audio (un bip), réellement enregistré par MediaRecorder.
 *
 * Utilisation :
 *   npm run build && npx vite preview --port 4173   (dans un terminal)
 *   npm i -D playwright && npx playwright install chromium   (une seule fois)
 *   npm run test:e2e
 * Variables : BASE_URL (défaut http://localhost:4173/), SHOTS=dossier pour des captures.
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const TITLE = `Test parcours ${Date.now()}`;
let step = 0;
const ok = (msg) => console.log(`✔ ${String(++step).padStart(2, '0')}. ${msg}`);
const fail = (msg) => {
  throw new Error(`✘ Étape ${step + 1} : ${msg}`);
};
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });

/** Lit « 0:02 / 0:05 » et renvoie les secondes écoulées. */
async function elapsed(locator) {
  const t = (await locator.textContent()) ?? '';
  const [m, s] = t.split('/')[0].trim().split(':').map(Number);
  return m * 60 + s;
}

async function expectPlayback(page, container, label) {
  await container.getByTestId('play-button').click();
  const time = container.getByTestId('player-time');
  await page.waitForFunction((el) => !/^0:00\s/.test(el.textContent ?? ''), await time.elementHandle(), { timeout: 8000 }).catch(() => fail(`${label} : la lecture ne progresse pas`));
  const s = await elapsed(time);
  await container.getByTestId('play-button').click(); // pause
  return s;
}

const browser = await chromium.launch({
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['microphone'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  // 1. Ouvrir l'application
  await page.goto(BASE);
  await page.getByText("HUMANISONS L'HUMAIN").first().waitFor();
  ok("Ouvrir l'application");

  // 2. Consulter le fil
  await page.getByTestId('post-card').first().waitFor();
  const n = await page.getByTestId('post-card').count();
  await page.getByTestId('feed-end').waitFor();
  await shot(page, '01-fil');
  ok(`Consulter le fil (${n} publications, message de fin de fil présent)`);

  // 3. Cliquer sur Témoigner
  await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Témoigner' }).click();
  await page.getByRole('heading', { name: 'Témoigner' }).waitFor();
  ok('Cliquer sur Témoigner');

  // 4. Saisir un titre et un texte
  await page.getByTestId('field-title').fill(TITLE);
  await page.getByTestId('field-text').fill("Ceci est un témoignage de test, écrit par le script automatisé.");
  ok('Saisir un titre et un texte');

  // 5. Enregistrer sa propre voix (avec pause et reprise)
  await page.getByTestId('rec-start').click();
  await page.getByTestId('rec-stop').waitFor({ timeout: 8000 });
  await page.waitForTimeout(2200);
  await shot(page, '02-enregistrement');
  await page.getByTestId('rec-pause').click();
  const pausedAt = await page.getByTestId('rec-clock').textContent();
  await page.waitForTimeout(1200);
  if ((await page.getByTestId('rec-clock').textContent()) !== pausedAt) fail('le chronomètre avance pendant la pause');
  await page.getByTestId('rec-resume').click();
  await page.waitForTimeout(1600);
  await page.getByTestId('rec-stop').click();
  await page.getByTestId('recording-preview').waitFor({ timeout: 10000 });
  ok(`Enregistrer sa voix (pause à ${pausedAt}, reprise, arrêt)`);

  // 6. Réécouter l'enregistrement
  const total = (await page.getByTestId('preview-time').textContent())?.split('/')[1].trim();
  if (!total || total === '0:00') fail(`durée de l'enregistrement invalide (${total})`);
  await page.getByTestId('preview-play').click();
  await page.waitForFunction(() => !/^0:00\s/.test(document.querySelector('[data-testid=preview-time]')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => fail('la réécoute ne progresse pas'));
  await page.getByTestId('preview-play').click();
  await shot(page, '03-reecoute');
  ok(`Réécouter l'enregistrement (durée ${total})`);

  // 7. Envoyer le témoignage à la modération
  await page.getByTestId('field-transcription').fill('Transcription manuelle du test.');
  await page.getByTestId('consent-publication').check();
  await page.getByTestId('consent-voice').check();
  await page.getByTestId('consent-third-party').check();
  await page.getByTestId('submit-moderation').click();
  await page.getByTestId('submit-confirmation').waitFor();
  // La contribution ne doit PAS être dans le fil avant modération.
  await page.goto(`${BASE}#/`);
  await page.getByTestId('post-card').first().waitFor();
  if (await page.getByText(TITLE).count()) fail('la contribution est visible dans le fil avant modération');
  ok('Envoyer à la modération (absente du fil tant que non validée)');

  // 8. Ouvrir l'interface d'administration locale
  await page.goto(`${BASE}#/admin/contributions`);
  await page.getByTestId('admin').waitFor();
  ok("Ouvrir l'administration locale");

  // 9. Écouter et examiner le témoignage
  await page.getByTestId('admin-item').filter({ hasText: TITLE }).click();
  const review = page.getByTestId('review-panel');
  await review.waitFor();
  const t9 = await expectPlayback(page, review, 'administration');
  await shot(page, '04-moderation');
  ok(`Écouter et examiner le témoignage (lecture jusqu'à ${t9} s)`);

  // 10. Valider la contribution
  await page.getByTestId('approve-publish').click();
  await page.getByText('Publié', { exact: true }).first().waitFor();
  ok('Valider la contribution');

  // 11. Retrouver la publication dans le fil principal
  await page.goto(`${BASE}#/`);
  const card = page.getByTestId('post-card').filter({ hasText: TITLE });
  await card.waitFor();
  if ((await page.getByTestId('post-card').first().textContent())?.includes(TITLE) !== true) fail("la publication n'est pas en tête du fil");
  ok('Retrouver la publication en tête du fil');

  // 12. Écouter le témoignage directement depuis sa carte
  const t12 = await expectPlayback(page, card, 'fil');
  await shot(page, '05-ecoute-fil');
  ok(`Écouter depuis la carte (lecture jusqu'à ${t12} s)`);

  // 13. Actualiser la page
  await page.reload();
  ok('Actualiser la page');

  // 14. Vérifier que le témoignage et son fichier audio sont toujours disponibles
  const card2 = page.getByTestId('post-card').filter({ hasText: TITLE });
  await card2.waitFor();
  const t14 = await expectPlayback(page, card2, 'après actualisation');
  const size = await page.evaluate(
    (title) =>
      new Promise((resolve) => {
        const r = indexedDB.open('hlh');
        r.onsuccess = () => {
          const db = r.result;
          db.transaction('posts').objectStore('posts').getAll().onsuccess = (e) => {
            const p = e.target.result.find((x) => x.title === title);
            db.transaction('media').objectStore('media').get(p.audio.id).onsuccess = (ev) => resolve(ev.target.result?.blob?.size ?? 0);
          };
        };
      }),
    TITLE,
  );
  if (!size) fail("le fichier audio n'est plus dans IndexedDB");
  ok(`Après actualisation : publication et audio présents (${size} octets, lecture jusqu'à ${t14} s)`);

  if (errors.length) fail(`erreurs JavaScript : ${errors.join(' | ')}`);

  // Bonus : refus du micro
  // (on simule la réponse du navigateur quand la personne refuse l'accès)
  const denied = await browser.newContext();
  await denied.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
  const p2 = await denied.newPage();
  await p2.goto(`${BASE}#/temoigner`);
  await p2.getByTestId('rec-start').click();
  await p2.getByTestId('rec-error').waitFor({ timeout: 8000 }).catch(() => fail("pas de message clair en cas de refus du micro"));
  console.log(`✔ Bonus. Refus du micro géré : « ${(await p2.getByTestId('rec-error').textContent())?.slice(0, 70)}… »`);
  await denied.close();

  console.log('\nParcours complet : OK');
} catch (e) {
  console.error(e.message);
  await shot(page, 'echec');
  process.exitCode = 1;
} finally {
  await browser.close();
}
