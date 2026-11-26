/**
 * Données de DÉMONSTRATION.
 *
 * Toutes ces publications sont FICTIVES et marquées `demo: true` : l'interface
 * affiche systématiquement la mention « Exemple fictif ». Aucun audio ne contient
 * de voix réelle : ce sont des sons synthétiques générés localement.
 * Le fondateur peut les supprimer en un clic depuis l'administration.
 */
import type { Post, PostType } from '../models/types';
import * as repo from '../services/repository';
import { analyzeAudio, neutralPeaks, synthesizeDemoWav } from '../lib/audio';

function daysAgo(d: number, h = 9): string {
  const t = new Date();
  t.setDate(t.getDate() - d);
  t.setHours(h, 0, 0, 0);
  return t.toISOString();
}

function base(id: string, type: PostType, categoryId: string, when: string): Post {
  return {
    id,
    type,
    title: '',
    categoryId,
    text: '',
    anonymous: false,
    images: [],
    sources: [],
    verification: 'non_verifie',
    status: 'publie',
    consent: { publication: true, voiceIdentifiable: true, at: when },
    createdAt: when,
    updatedAt: when,
    publishedAt: when,
    demo: true,
    private: {},
  };
}

/** Affiche fictive dessinée en SVG pour illustrer un « Instantané du monde ». */
function demoPosterSvg(): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#1f1f1f"/></linearGradient></defs>
  <rect width="1200" height="800" fill="url(#g)"/>
  <rect x="0" y="560" width="1200" height="240" fill="#2b2622"/>
  <rect x="300" y="120" width="600" height="420" rx="10" fill="#efe9df"/>
  <text x="600" y="220" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#292929" text-anchor="middle">VOTRE SATISFACTION</text>
  <text x="600" y="285" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#292929" text-anchor="middle">EST NOTRE PRIORITÉ</text>
  <line x1="400" y1="330" x2="800" y2="330" stroke="#A9604C" stroke-width="4"/>
  <text x="600" y="400" font-family="Arial, sans-serif" font-size="30" fill="#555" text-anchor="middle">Accueil fermé.</text>
  <text x="600" y="445" font-family="Arial, sans-serif" font-size="30" fill="#555" text-anchor="middle">Merci d'utiliser la borne automatique.</text>
  <rect x="930" y="330" width="140" height="230" rx="12" fill="#4a4a4a"/>
  <rect x="955" y="360" width="90" height="70" rx="6" fill="#7DA98A" opacity="0.5"/>
  <text x="600" y="740" font-family="Arial, sans-serif" font-size="26" fill="#C98670" text-anchor="middle">ILLUSTRATION FICTIVE — DONNÉE DE DÉMONSTRATION</text>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

async function demoAudio(seconds: number, seed: number) {
  const blob = synthesizeDemoWav(seconds, seed);
  const ref = await repo.saveMedia(blob, `demo-${seed}.wav`);
  const analysis = await analyzeAudio(blob);
  return {
    ...ref,
    duration: analysis?.duration ?? seconds,
    peaks: analysis?.peaks ?? neutralPeaks(seed),
    original: false,
    synthetic: true,
    source: 'demo' as const,
    publishVoice: true,
  };
}

export async function seedDemoData(): Promise<void> {
  const posts: Post[] = [];

  const p1 = base('demo_chiffre', 'temoignage', 'cat_1', daysAgo(0, 8));
  p1.title = 'À quel moment suis-je devenu un simple chiffre ?';
  p1.anonymous = true;
  p1.text =
    "Cela fait quinze ans que je travaille dans la même entreprise. Aujourd'hui, j'ai l'impression que tout ce qui compte, ce sont mes résultats. Plus personne ne me demande comment je vais.";
  p1.reflection = 'Quand un indicateur remplace une conversation, que perd-on exactement ?';
  p1.audio = await demoAudio(24, 1);
  p1.transcription =
    "[Exemple fictif — l'audio de démonstration est un son synthétique, pas une voix.]\nCela fait quinze ans que je travaille dans la même entreprise. Aujourd'hui, j'ai l'impression que tout ce qui compte, ce sont mes résultats…";
  p1.transcriptionSource = 'manuelle';
  posts.push(p1);

  const p2 = base('demo_patienter', 'actualite', 'cat_8', daysAgo(1, 18));
  p2.title = 'Pour parler à un humain, veuillez patienter.';
  p2.authorName = 'Rédaction HLH (exemple)';
  p2.text =
    "La disparition progressive des interlocuteurs humains dans les services du quotidien pose une question : à qui profite réellement le gain de temps ?";
  p2.verification = 'a_documenter';
  posts.push(p2);

  const p3 = base('demo_paradoxe', 'paradoxe', 'cat_3', daysAgo(2, 12));
  p3.title = "L'humain au cœur… du tableur";
  p3.anonymous = true;
  p3.promise = "« L'humain au cœur de nos préoccupations. »";
  p3.reality = "« Suppression de l'accueil physique pour réduire les coûts. »";
  p3.text = 'Une affiche, un slogan, une décision. Le décalage entre les deux dit souvent plus que de longs discours.';
  posts.push(p3);

  const p4 = base('demo_instantane', 'instantane', 'cat_8', daysAgo(3, 10));
  p4.title = 'Votre satisfaction est notre priorité';
  p4.authorName = 'Observateur (exemple)';
  p4.text = "Vu à l'entrée d'un service : l'accueil est fermé, une borne remplace la personne qui s'y trouvait.";
  const img = await repo.saveMedia(demoPosterSvg(), 'affiche-fictive.svg');
  p4.images = [img];
  posts.push(p4);

  const p5 = base('demo_voisins', 'espoir', 'cat_12', daysAgo(4, 16));
  p5.title = "Une épicerie où l'on a le droit de prendre son temps";
  p5.authorName = 'Camille (exemple)';
  p5.text =
    "Dans mon quartier, une petite épicerie a installé une caisse « sans se presser » : la personne en caisse prend le temps de discuter avec celles et ceux qui en ont besoin. Personne ne râle. Au contraire.";
  p5.audio = await demoAudio(18, 3);
  p5.transcription = "[Exemple fictif — son synthétique, pas une voix.]\nDans mon quartier, une petite épicerie a installé une caisse « sans se presser »…";
  p5.transcriptionSource = 'manuelle';
  posts.push(p5);

  const p6 = base('demo_attention', 'reflexion', 'cat_4', daysAgo(6, 20));
  p6.title = 'Notre attention est-elle encore à nous ?';
  p6.authorName = 'Rédaction HLH (exemple)';
  p6.text =
    "Des applications conçues pour retenir notre regard le plus longtemps possible. Des notifications pensées pour nous faire revenir. Et si la vraie liberté commençait par le droit de s'ennuyer, de lever les yeux, de ne rien faire ?";
  posts.push(p6);

  for (const p of posts) await repo.savePost(p);
}

/** Initialise les données au tout premier lancement. */
export async function ensureSeeded(): Promise<void> {
  // Base partagée : rien n'est créé automatiquement (l'admin peut recréer les exemples).
  if (repo.isRemote || (await repo.isSeeded())) return;
  await repo.markSeeded();
  await seedDemoData();
}
