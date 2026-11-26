/** Outils audio : analyse de l'onde, formats d'enregistrement, audio de démonstration. */

export const PEAK_COUNT = 64;

/** Formats testés dans l'ordre de préférence pour MediaRecorder. */
const RECORDER_MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/aac'];

export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return RECORDER_MIMES.find((m) => {
    try {
      return MediaRecorder.isTypeSupported(m);
    } catch {
      return false;
    }
  });
}

export function extensionFor(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  return 'audio';
}

type AC = typeof AudioContext;
function audioContextCtor(): AC | undefined {
  return (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext) as AC | undefined;
}

/**
 * Décode un fichier audio pour calculer sa durée et son onde (valeurs 0..1).
 * Si le navigateur ne sait pas décoder le format, renvoie null : l'appelant
 * utilisera alors la durée mesurée et une onde neutre.
 */
export async function analyzeAudio(blob: Blob, bars = PEAK_COUNT): Promise<{ duration: number; peaks: number[] } | null> {
  const Ctor = audioContextCtor();
  if (!Ctor) return null;
  const ctx = new Ctor();
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const data = buf.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / bars));
    const peaks: number[] = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      const start = i * step;
      const end = Math.min(data.length, start + step);
      for (let j = start; j < end; j++) sum += data[j] * data[j];
      peaks.push(Math.sqrt(sum / Math.max(1, end - start)));
    }
    const max = Math.max(...peaks, 0.0001);
    return { duration: buf.duration, peaks: peaks.map((p) => Math.max(0.06, Math.min(1, p / max))) };
  } catch {
    return null;
  } finally {
    ctx.close().catch(() => undefined);
  }
}

/** Durée lue via un élément <audio> (repli si le décodage échoue). */
export function probeDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const a = document.createElement('audio');
    const url = URL.createObjectURL(blob);
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) done(a.duration);
      else {
        // Astuce connue pour les fichiers webm sans durée dans l'en-tête.
        a.ontimeupdate = () => {
          a.ontimeupdate = null;
          done(a.duration);
        };
        a.currentTime = 1e7;
      }
    };
    a.onerror = () => done(0);
    a.src = url;
    setTimeout(() => done(0), 4000);
  });
}

/** Onde neutre (quand le décodage est impossible). */
export function neutralPeaks(seed = 1, bars = PEAK_COUNT): number[] {
  let x = seed;
  return Array.from({ length: bars }, (_, i) => {
    x = (x * 9301 + 49297) % 233280;
    const env = 0.55 + 0.45 * Math.sin((i / bars) * Math.PI);
    return Math.max(0.12, env * (0.35 + (x / 233280) * 0.65));
  });
}

/**
 * Génère un audio de DÉMONSTRATION synthétique (aucune voix humaine) au format WAV.
 * Il sert uniquement à montrer le lecteur avec les données fictives.
 */
export function synthesizeDemoWav(seconds = 24, seed = 1): Blob {
  const rate = 16000;
  const n = Math.floor(seconds * rate);
  const buffer = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buffer);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  w(8, 'WAVE');
  w(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, 'data');
  v.setUint32(40, n * 2, true);
  // Accord doux qui « respire » : notes tenues avec enveloppe lente.
  const notes = [
    [220, 277.18, 329.63],
    [196, 246.94, 293.66],
    [174.61, 220, 261.63],
    [196, 246.94, 329.63],
  ];
  const seg = rate * 3;
  for (let i = 0; i < n; i++) {
    const chord = notes[(Math.floor(i / seg) + seed) % notes.length];
    const t = i / rate;
    const local = (i % seg) / seg;
    const env = Math.sin(Math.PI * local) ** 1.5;
    const breath = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.23 * t + seed);
    let s = 0;
    for (const f of chord) s += Math.sin(2 * Math.PI * f * t) * 0.18;
    const fade = Math.min(1, t / 0.5, (seconds - t) / 0.8);
    v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, s * env * breath * fade)) * 0x5fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}
