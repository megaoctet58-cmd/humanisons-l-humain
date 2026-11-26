/** Mini-lecteur persistant : visible quand on continue à parcourir pendant une écoute. */
import { useAudio } from '../audio/AudioProvider';
import { Icon } from './Icon';
import { formatTime } from '../lib/util';
import { navigate } from '../lib/router';

export function MiniPlayer() {
  const a = useAudio();
  if (!a.track || a.inlineVisible) return null;
  const progress = a.duration ? a.time / a.duration : 0;
  return (
    <div className="mini" role="region" aria-label="Lecture en cours" data-testid="mini-player">
      <div className="mini__progress" style={{ transform: `scaleX(${progress})` }} />
      <button type="button" className="mini__btn" onClick={() => a.toggle(a.track!)} aria-label={a.playing ? 'Pause' : 'Lecture'}>
        <Icon name={a.playing ? 'pause' : 'play'} size={18} filled={!a.playing} />
      </button>
      <button type="button" className="mini__title" onClick={() => navigate(`/publication/${a.track!.id}`)}>
        <span className="mini__kicker">La voix du témoin</span>
        <span className="mini__name">{a.track.title}</span>
      </button>
      <span className="mini__time tabular">
        {formatTime(a.time)} / {formatTime(a.duration)}
      </span>
      <button type="button" className="icon-btn" onClick={a.close} aria-label="Fermer le lecteur">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
