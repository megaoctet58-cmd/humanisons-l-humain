/**
 * Transcription de la voix en texte.
 *
 * Moteur : Whisper (modèle « base », multilingue) exécuté dans le navigateur.
 * - Gratuit, sans serveur : l'enregistrement ne quitte jamais l'appareil.
 * - Le modèle (~ 120 Mo) est téléchargé à la première utilisation, puis gardé en cache.
 * - Le texte obtenu est une PROPOSITION : l'auteur le relit et le corrige avant envoi.
 * - La transcription ne remplace jamais l'enregistrement original.
 */

export interface TranscriptionProgress {
  phase: 'preparation' | 'telechargement' | 'transcription';
  /** 0..100 pendant le téléchargement du modèle. */
  percent?: number;
}

export interface TranscriptionEngine {
  id: string;
  label: string;
  /** Renvoie un texte brut que l'auteur pourra corriger avant publication. */
  transcribe(audio: Blob, onProgress?: (p: TranscriptionProgress) => void, lang?: string): Promise<string>;
}

/** Décode un fichier audio en échantillons mono à 16 kHz (format attendu par Whisper). */
export async function decodeTo16kMono(blob: Blob): Promise<Float32Array> {
  const buf = await blob.arrayBuffer();
  const Ctx = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  // Le décodage dans un contexte à 16 kHz rééchantillonne automatiquement.
  const decoded = await new Ctx(1, 1, 16000).decodeAudioData(buf);
  if (decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice();
  const out = new Float32Array(decoded.length);
  for (let c = 0; c < decoded.numberOfChannels; c++) {
    const ch = decoded.getChannelData(c);
    for (let i = 0; i < ch.length; i++) out[i] += ch[i] / decoded.numberOfChannels;
  }
  return out;
}

let worker: Worker | null = null;

const whisperEngine: TranscriptionEngine = {
  id: 'whisper-base-navigateur',
  label: 'Whisper (dans votre navigateur)',
  async transcribe(audio, onProgress, lang = 'french') {
    onProgress?.({ phase: 'preparation' });
    let samples: Float32Array;
    try {
      samples = await decodeTo16kMono(audio);
    } catch {
      throw new Error('Ce navigateur ne parvient pas à lire cet enregistrement pour le transcrire.');
    }
    if (!worker) worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
    const w = worker;
    return new Promise<string>((resolve, reject) => {
      w.onmessage = (e: MessageEvent<{ type: string; percent?: number; text?: string; message?: string }>) => {
        const m = e.data;
        if (m.type === 'download') onProgress?.({ phase: 'telechargement', percent: m.percent });
        else if (m.type === 'transcribing') onProgress?.({ phase: 'transcription' });
        else if (m.type === 'done') resolve(m.text ?? '');
        else if (m.type === 'error') {
          const offline = /fetch|network|Failed|load/i.test(m.message ?? '');
          reject(new Error(offline ? 'Le modèle de transcription n’a pas pu être téléchargé. Vérifiez votre connexion et réessayez.' : `Transcription impossible : ${m.message}`));
        }
      };
      w.onerror = () => reject(new Error('Transcription impossible sur ce navigateur.'));
      w.postMessage({ audio: samples, language: lang }, [samples.buffer]);
    });
  },
};

/** Disponible si le navigateur sait faire tourner WebAssembly dans un worker. */
export function isAutomaticTranscriptionAvailable(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
}

export const transcriptionEngine: TranscriptionEngine = whisperEngine;
