/**
 * Lecteur audio intégré directement dans la carte d'une publication.
 * « La voix du témoin » · lecture/pause · onde · progression · vitesse · transcription.
 */
import { useEffect, useRef, useState } from 'react';
import type { Post } from '../models/types';
import { useAudio } from '../audio/AudioProvider';
import { Waveform } from './Waveform';
import { Icon } from './Icon';
import { formatDurationLong, formatTime } from '../lib/util';

const RATES = [0.75, 1, 1.25, 1.5];

export function AudioPlayer({ post, startOpen = false }: { post: Post; startOpen?: boolean }) {
  const audio = useAudio();
  const info = post.audio!;
  const isCurrent = audio.track?.id === post.id;
  const playing = isCurrent && audio.playing;
  const duration = isCurrent && audio.duration ? audio.duration : info.duration;
  const time = isCurrent ? audio.time : 0;
  const progress = duration ? time / duration : 0;
  const [showTranscript, setShowTranscript] = useState(startOpen);
  const ref = useRef<HTMLDivElement>(null);

  // Signale si la carte en cours de lecture est visible (sinon : mini-lecteur).
  useEffect(() => {
    if (!isCurrent || !ref.current || typeof IntersectionObserver === 'undefined') return;
    const el = ref.current;
    const obs = new IntersectionObserver(([e]) => audio.setInlineVisible(post.id, e.isIntersecting), { threshold: 0.3 });
    obs.observe(el);
    return () => {
      obs.disconnect();
      audio.setInlineVisible(post.id, false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCurrent, post.id]);

  const toggle = () => audio.toggle({ id: post.id, mediaId: info.id, title: post.title, duration: info.duration });
  const nextRate = () => audio.setRate(RATES[(RATES.indexOf(audio.rate) + 1) % RATES.length]);
  const hasTranscript = Boolean(post.transcription?.trim());

  return (
    <div className="player" ref={ref} data-testid="audio-player">
      <div className="player__head">
        <span className="player__label">
          <Icon name="mic" size={16} /> La voix du témoin
        </span>
        <span className="player__total">{formatDurationLong(info.duration)}</span>
      </div>
      <div className="player__body">
        <button
          type="button"
          className="player__btn"
          onClick={toggle}
          aria-label={playing ? `Mettre en pause « ${post.title} »` : `Écouter « ${post.title} »`}
          aria-pressed={playing}
          data-testid="play-button"
        >
          {isCurrent && audio.loading ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={22} filled={!playing} />}
        </button>
        <Waveform
          peaks={info.peaks}
          progress={progress}
          onSeek={(f) => {
            if (!isCurrent) toggle();
            else audio.seek(f);
          }}
          label={`Position de lecture de « ${post.title} »`}
        />
      </div>
      <div className="player__meta">
        <span className="tabular" data-testid="player-time">
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <span className="player__tags">
          {info.synthetic ? (
            <span className="badge badge--demo" title="Audio de démonstration : son synthétique, aucune voix réelle">Son synthétique (démo)</span>
          ) : info.original ? (
            <span>Voix originale</span>
          ) : null}
          <button type="button" className="linkish" onClick={nextRate} aria-label={`Vitesse de lecture : ${audio.rate}×. Changer`}>
            {String(audio.rate).replace('.', ',')}×
          </button>
        </span>
      </div>
      {isCurrent && audio.error && <p className="player__error" role="alert">{audio.error}</p>}
      {hasTranscript && (
        <>
          <button type="button" className="player__transcript-toggle" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>
            {showTranscript ? 'Masquer la transcription' : 'Lire la transcription'} <Icon name={showTranscript ? 'chevronUp' : 'chevronDown'} size={16} />
          </button>
          {showTranscript && (
            <div className="player__transcript">
              <p className="small muted">Transcription {post.transcriptionSource === 'automatique' ? 'automatique corrigée par l’auteur' : 'saisie manuellement'}</p>
              <p className="prewrap">{post.transcription}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
