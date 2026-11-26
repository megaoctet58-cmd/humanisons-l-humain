/** Représentation de l'onde sonore sous forme de barres verticales. */
import type { KeyboardEvent, MouseEvent } from 'react';
import { cx } from '../lib/util';

interface Props {
  peaks: number[];
  progress?: number; // 0..1
  onSeek?: (fraction: number) => void;
  height?: number;
  label?: string;
  className?: string;
  muted?: boolean;
}

export function Waveform({ peaks, progress = 0, onSeek, height = 48, label, className, muted }: Props) {
  const interactive = Boolean(onSeek);
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const r = e.currentTarget.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
  };
  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    if (e.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.05));
    else if (e.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.05));
    else return;
    e.preventDefault();
  };
  const n = peaks.length || 1;
  return (
    <div
      className={cx('waveform', interactive && 'waveform--interactive', muted && 'waveform--muted', className)}
      style={{ height }}
      onClick={handleClick}
      onKeyDown={handleKey}
      role={interactive ? 'slider' : 'img'}
      tabIndex={interactive ? 0 : undefined}
      aria-label={label ?? 'Onde sonore'}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      aria-valuenow={interactive ? Math.round(progress * 100) : undefined}
    >
      {peaks.map((p, i) => (
        <span key={i} className={cx('waveform__bar', i / n < progress && 'is-played')} style={{ height: `${Math.max(6, p * 100)}%` }} />
      ))}
    </div>
  );
}
