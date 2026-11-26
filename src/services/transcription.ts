/**
 * Transcription de la voix en texte.
 *
 * V0.1 : AUCUN moteur automatique n'est branché. La transcription est saisie
 * manuellement par l'auteur. Cette interface prépare l'intégration future
 * (Whisper auto-hébergé, whisper.cpp en WebAssembly, ou service distant),
 * sans jamais remplacer l'enregistrement original.
 */

export interface TranscriptionEngine {
  id: string;
  label: string;
  /** Renvoie un texte brut que l'auteur pourra corriger avant publication. */
  transcribe(audio: Blob, lang?: string): Promise<string>;
}

/** Moteur actuellement disponible : aucun. */
export const transcriptionEngine: TranscriptionEngine | null = null;

export function isAutomaticTranscriptionAvailable(): boolean {
  return transcriptionEngine !== null;
}
