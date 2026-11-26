/**
 * Transcription automatique DANS LE NAVIGATEUR (Whisper, via Transformers.js).
 *
 * Tourne dans un « worker » pour ne pas figer la page. L'enregistrement ne quitte
 * jamais l'appareil : seul le modèle (fichiers publics) est téléchargé, une fois,
 * puis gardé en cache par le navigateur. Gratuit, sans compte, sans serveur.
 */
import { env, pipeline } from '@huggingface/transformers';

env.allowLocalModels = false;

export const MODEL = 'onnx-community/whisper-base';

type Asr = (audio: Float32Array, options: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
let asr: Promise<Asr> | null = null;

const post = (m: unknown) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<{ audio: Float32Array; language?: string }>) => {
  try {
    if (!asr) {
      asr = pipeline('automatic-speech-recognition', MODEL, {
        dtype: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
        device: 'wasm',
        progress_callback: (p: { status: string; progress?: number; loaded?: number; total?: number }) => {
          if (p.status === 'progress_total') post({ type: 'download', percent: p.progress ?? 0, loaded: p.loaded, total: p.total });
        },
      }) as unknown as Promise<Asr>;
    }
    const run = await asr;
    post({ type: 'transcribing' });
    const out = await run(e.data.audio, { language: e.data.language ?? 'french', task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
    const text = (Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text).replace(/\s+/g, ' ').trim();
    post({ type: 'done', text });
  } catch (err) {
    asr = null;
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
