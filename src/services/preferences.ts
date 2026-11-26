/**
 * Préférences simples conservées dans localStorage (thème, pseudonyme par défaut…).
 * Toutes les lectures/écritures sont protégées : en navigation privée stricte,
 * localStorage peut être indisponible, l'application continue alors sans mémoire.
 */

export type ThemePref = 'light' | 'dark' | 'system';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignoré */
  }
}

export function getTheme(): ThemePref {
  const t = read('hlh.theme');
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function setTheme(t: ThemePref) {
  write('hlh.theme', t === 'system' ? null : t);
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
}

export function effectiveTheme(): 'light' | 'dark' {
  const t = getTheme();
  if (t !== 'system') return t;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function getPseudonym(): string {
  return read('hlh.pseudonym') ?? '';
}

export function setPseudonym(p: string) {
  write('hlh.pseudonym', p.trim() || null);
}

export function getPlaybackRate(): number {
  const r = Number(read('hlh.rate'));
  return [0.75, 1, 1.25, 1.5].includes(r) ? r : 1;
}

export function setPlaybackRate(r: number) {
  write('hlh.rate', String(r));
}
