/** Choix du thème : clair, sombre ou réglage de l'appareil. Mémorisé localement. */
import { useState } from 'react';
import { getTheme, setTheme, type ThemePref } from '../services/preferences';
import { cx } from '../lib/util';

export function ThemeChooser() {
  const [t, setT] = useState<ThemePref>(getTheme);
  const opts: [ThemePref, string][] = [
    ['light', 'Clair'],
    ['dark', 'Sombre'],
    ['system', 'Comme l’appareil'],
  ];
  return (
    <div className="segmented" role="radiogroup" aria-label="Thème">
      {opts.map(([v, label]) => (
        <label key={v} className={cx('segmented__opt', t === v && 'is-on')}>
          <input
            type="radio"
            name="theme"
            checked={t === v}
            onChange={() => {
              setTheme(v);
              setT(v);
              window.dispatchEvent(new Event('hlh-theme'));
            }}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
