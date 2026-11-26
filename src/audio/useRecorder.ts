/**
 * Enregistrement réel de la voix via l'API MediaRecorder du navigateur.
 * Gère : autorisation du micro, chronomètre, onde en direct, pause/reprise
 * (si le navigateur le permet), arrêt automatique à la durée maximale.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { pickRecorderMime } from '../lib/audio';

export type RecState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

export interface RecResult {
  blob: Blob;
  mime: string;
  elapsed: number;
}

const LEVEL_COUNT = 64;

export function recorderSupport(): { ok: boolean; reason?: string } {
  if (typeof window === 'undefined') return { ok: false };
  if (!window.isSecureContext)
    return { ok: false, reason: "L'enregistrement nécessite une connexion sécurisée (https:// ou http://localhost)." };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "Ce navigateur ne permet pas d'accéder au microphone." };
  if (typeof MediaRecorder === 'undefined') return { ok: false, reason: "Ce navigateur ne permet pas l'enregistrement audio (MediaRecorder absent)." };
  return { ok: true };
}

function explainError(e: unknown): string {
  const name = (e as { name?: string })?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return "L'accès au microphone a été refusé. Vous pouvez l'autoriser dans les réglages du navigateur (icône à gauche de l'adresse), puis réessayer. Vous pouvez aussi importer un fichier audio ou témoigner par écrit.";
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Aucun microphone n’a été détecté sur cet appareil.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Le microphone est déjà utilisé par une autre application. Fermez-la puis réessayez.';
    case 'NotSupportedError':
      return "Ce navigateur ne permet pas l'accès au microphone dans ce contexte. Vous pouvez importer un fichier audio ou témoigner par écrit.";
    case 'SecurityError':
      return "L'accès au microphone est bloqué dans ce contexte (connexion non sécurisée ou page intégrée).";
    default:
      return `Impossible de démarrer l'enregistrement${e instanceof Error && e.message ? ` : ${e.message}` : '.'}`;
  }
}

export function useRecorder(maxSeconds: number, onDone: (r: RecResult) => void) {
  const [state, setState] = useState<RecState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_COUNT).fill(0.05));
  const [error, setError] = useState<string>();
  const [canPause, setCanPause] = useState(true);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const ctx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const timer = useRef<number>();
  const accumulated = useRef(0); // secondes enregistrées avant la dernière reprise
  const segmentStart = useRef(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cleanup = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = undefined;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    ctx.current?.close().catch(() => undefined);
    ctx.current = null;
    analyser.current = null;
  }, []);

  useEffect(() => () => {
    try {
      if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
    } catch {
      /* ignoré */
    }
    cleanup();
  }, [cleanup]);

  const currentElapsed = () =>
    accumulated.current + (rec.current?.state === 'recording' ? (performance.now() - segmentStart.current) / 1000 : 0);

  const stop = useCallback(() => {
    const r = rec.current;
    if (!r || r.state === 'inactive') return;
    accumulated.current = currentElapsed();
    setElapsed(accumulated.current);
    r.stop();
  }, []);

  const tick = useCallback(() => {
    const e = currentElapsed();
    setElapsed(e);
    const an = analyser.current;
    if (an && rec.current?.state === 'recording') {
      const buf = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.min(1, Math.sqrt(sum / buf.length) * 4);
      setLevels((l) => [...l.slice(1), Math.max(0.05, rms)]);
    }
    if (e >= maxSeconds) stop();
  }, [maxSeconds, stop]);

  const start = useCallback(async () => {
    const sup = recorderSupport();
    if (!sup.ok) {
      setError(sup.reason);
      setState('error');
      return;
    }
    setError(undefined);
    setState('requesting');
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        // On conserve la voix au plus près de l'original : pas de traitement agressif.
        audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
      });
      stream.current = s;
      const mime = pickRecorderMime();
      const r = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
      rec.current = r;
      chunks.current = [];
      setCanPause(typeof r.pause === 'function');
      r.ondataavailable = (ev) => ev.data.size > 0 && chunks.current.push(ev.data);
      r.onstop = () => {
        const type = r.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunks.current, { type });
        cleanup();
        setState('stopped');
        onDoneRef.current({ blob, mime: type, elapsed: accumulated.current });
      };
      r.onerror = () => {
        cleanup();
        setError("Une erreur s'est produite pendant l'enregistrement.");
        setState('error');
      };
      // Onde en direct (facultative : si elle échoue, l'enregistrement continue).
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const c = new Ctor();
        const an = c.createAnalyser();
        an.fftSize = 1024;
        c.createMediaStreamSource(s).connect(an);
        ctx.current = c;
        analyser.current = an;
      } catch {
        analyser.current = null;
      }
      accumulated.current = 0;
      segmentStart.current = performance.now();
      setElapsed(0);
      setLevels(Array(LEVEL_COUNT).fill(0.05));
      r.start(1000);
      setState('recording');
      timer.current = window.setInterval(tick, 100);
    } catch (e) {
      cleanup();
      setError(explainError(e));
      setState('error');
    }
  }, [cleanup, tick]);

  const pause = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== 'recording' || typeof r.pause !== 'function') return;
    accumulated.current = currentElapsed();
    r.pause();
    setState('paused');
  }, []);

  const resume = useCallback(() => {
    const r = rec.current;
    if (!r || r.state !== 'paused') return;
    segmentStart.current = performance.now();
    r.resume();
    setState('recording');
  }, []);

  const reset = useCallback(() => {
    cleanup();
    rec.current = null;
    chunks.current = [];
    accumulated.current = 0;
    setElapsed(0);
    setError(undefined);
    setLevels(Array(LEVEL_COUNT).fill(0.05));
    setState('idle');
  }, [cleanup]);

  return { state, elapsed, levels, error, canPause, start, pause, resume, stop, reset };
}
