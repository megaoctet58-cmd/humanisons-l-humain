/**
 * Enregistreur vocal : « Racontez votre histoire ».
 * Enregistrer · mettre en pause · reprendre · arrêter · réécouter · recommencer · importer.
 */
import { useEffect, useRef, useState } from 'react';
import { useRecorder } from '../audio/useRecorder';
import { useAudio } from '../audio/AudioProvider';
import { analyzeAudio, extensionFor, neutralPeaks, probeDuration } from '../lib/audio';
import { formatBytes, formatClock, formatTime } from '../lib/util';
import { Waveform } from './Waveform';
import { Icon } from './Icon';

export interface AudioDraft {
  blob: Blob;
  mime: string;
  name: string;
  duration: number;
  peaks: number[];
  source: 'micro' | 'import';
}

const MAX_IMPORT_BYTES = 40 * 1024 * 1024;
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|webm|flac|mp4)$/i;

/** Réécoute locale, indépendante du lecteur du fil. */
export function LocalPreview({ draft }: { draft: AudioDraft }) {
  const global = useAudio();
  const ref = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);

  useEffect(() => {
    const u = URL.createObjectURL(draft.blob);
    setUrl(u);
    const a = new Audio(u);
    a.preload = 'auto';
    ref.current = a;
    a.ontimeupdate = () => setTime(a.currentTime);
    a.onplay = () => setPlaying(true);
    a.onpause = () => setPlaying(false);
    a.onended = () => (setPlaying(false), setTime(0));
    return () => {
      a.pause();
      URL.revokeObjectURL(u);
    };
  }, [draft.blob]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      if (global.track) global.close();
      a.play().catch(() => undefined);
    } else a.pause();
  };
  const seek = (f: number) => {
    const a = ref.current;
    if (a && draft.duration) a.currentTime = f * draft.duration;
  };

  return (
    <div className="player player--preview" data-testid="recording-preview">
      <div className="player__head">
        <span className="player__label">
          <Icon name="mic" size={16} /> Réécoute avant envoi
        </span>
        <span className="player__total">{draft.source === 'micro' ? 'Enregistré' : 'Importé'} · {formatBytes(draft.blob.size)}</span>
      </div>
      <div className="player__body">
        <button type="button" className="player__btn" onClick={toggle} aria-label={playing ? 'Mettre en pause la réécoute' : 'Réécouter mon enregistrement'} data-testid="preview-play" disabled={!url}>
          <Icon name={playing ? 'pause' : 'play'} size={22} filled={!playing} />
        </button>
        <Waveform peaks={draft.peaks} progress={draft.duration ? time / draft.duration : 0} onSeek={seek} label="Position de réécoute" />
      </div>
      <div className="player__meta">
        <span className="tabular" data-testid="preview-time">
          {formatTime(time)} / {formatTime(draft.duration)}
        </span>
        <span>Voix originale, sans modification</span>
      </div>
    </div>
  );
}

export function Recorder({ maxSeconds, value, onChange }: { maxSeconds: number; value: AudioDraft | null; onChange: (d: AudioDraft | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const finalize = async (blob: Blob, mime: string, name: string, source: AudioDraft['source'], measured: number) => {
    setBusy(true);
    const analysis = await analyzeAudio(blob);
    let duration = analysis?.duration ?? 0;
    if (!duration || !Number.isFinite(duration)) duration = measured || (await probeDuration(blob));
    onChange({ blob, mime, name, duration, peaks: analysis?.peaks ?? neutralPeaks(Math.round(blob.size % 997)), source });
    setBusy(false);
    return duration;
  };

  const r = useRecorder(maxSeconds, ({ blob, mime, elapsed }) => {
    finalize(blob, mime, `temoignage-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${extensionFor(mime)}`, 'micro', elapsed);
  });

  const discard = () => {
    onChange(null);
    r.reset();
  };

  const importFile = async (file: File) => {
    setImportError(undefined);
    if (!file.type.startsWith('audio/') && !AUDIO_EXT.test(file.name)) {
      setImportError('Ce fichier ne semble pas être un fichier audio (formats acceptés : mp3, m4a, wav, ogg, webm, flac…).');
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setImportError(`Fichier trop volumineux (${formatBytes(file.size)}). Taille maximale : ${formatBytes(MAX_IMPORT_BYTES)}.`);
      return;
    }
    r.reset();
    const d = await finalize(file, file.type || 'audio/mpeg', file.name, 'import', 0);
    if (d > maxSeconds + 1) {
      onChange(null);
      setImportError(`Ce fichier dure ${formatTime(d)}. La durée maximale proposée est de ${Math.round(maxSeconds / 60)} minutes.`);
    } else if (!d) {
      setImportError('Attention : ce navigateur ne parvient pas à lire ce format. Il sera tout de même transmis à la modération.');
    }
  };

  const recording = r.state === 'recording';
  const paused = r.state === 'paused';
  const active = recording || paused;
  const remaining = Math.max(0, maxSeconds - r.elapsed);

  if (value) {
    return (
      <div className="recorder recorder--done">
        <LocalPreview draft={value} />
        <div className="row-center">
          <button type="button" className="btn btn--ghost" onClick={discard} data-testid="discard-recording">
            <Icon name="trash" size={16} /> Supprimer et recommencer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recorder" data-testid="recorder">
      <h3 className="recorder__title">Racontez votre histoire</h3>
      <p className="recorder__subtitle">Prenez votre temps. Votre voix compte.</p>
      <p className={`recorder__clock tabular${recording ? ' is-live' : ''}`} aria-live="off" data-testid="rec-clock">
        {formatClock(r.elapsed)}
      </p>
      <Waveform peaks={r.levels} progress={active ? 1 : 0} height={40} className="recorder__wave" label="Niveau sonore du micro" muted={!active} />

      {!active ? (
        <>
          <button
            type="button"
            className="rec-btn"
            onClick={r.start}
            disabled={r.state === 'requesting' || busy}
            aria-label="Commencer l'enregistrement"
            data-testid="rec-start"
          >
            {r.state === 'requesting' || busy ? <span className="spinner spinner--light" /> : <Icon name="mic" size={30} />}
          </button>
          <p className="recorder__action">{busy ? 'Préparation de la réécoute…' : r.state === 'requesting' ? 'Autorisation du micro…' : "Commencer l'enregistrement"}</p>
        </>
      ) : (
        <>
          <div className="recorder__controls">
            {r.canPause && (
              <button type="button" className="round-btn" onClick={paused ? r.resume : r.pause} aria-label={paused ? 'Reprendre' : 'Mettre en pause'} data-testid={paused ? 'rec-resume' : 'rec-pause'}>
                <Icon name={paused ? 'mic' : 'pause'} size={22} />
              </button>
            )}
            <button type="button" className="rec-btn rec-btn--stop" onClick={r.stop} aria-label="Arrêter l'enregistrement" data-testid="rec-stop">
              <Icon name="stop" size={26} filled />
            </button>
          </div>
          <p className="recorder__action" aria-live="polite">
            {paused ? 'En pause' : 'Enregistrement en cours…'} · reste {formatClock(remaining)}
          </p>
        </>
      )}

      <p className="recorder__hint">Durée maximale proposée : {Math.round(maxSeconds / 60)} minutes</p>
      {r.error && (
        <p className="alert" role="alert" data-testid="rec-error">
          {r.error}
        </p>
      )}
      {importError && (
        <p className="alert" role="alert">
          {importError}
        </p>
      )}

      <div className="recorder__import">
        <button type="button" className="linkish" onClick={() => fileRef.current?.click()} disabled={active || busy}>
          <Icon name="upload" size={16} /> Ou importer un fichier audio existant
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm,.flac,.opus"
          hidden
          data-testid="audio-import"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) importFile(f);
          }}
        />
      </div>
    </div>
  );
}
