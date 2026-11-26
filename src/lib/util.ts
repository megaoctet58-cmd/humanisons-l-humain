/** Utilitaires génériques. */

export function uid(prefix = 'id'): string {
  const rnd = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 13) : Math.random().toString(36).slice(2, 15);
  return `${prefix}_${Date.now().toString(36)}${rnd.replace(/-/g, '')}`;
}

/** 0:00 / 3:42 */
export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** 00:00 (chronomètre de l'enregistreur) */
export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** « 3 min 42 » */
export function formatDurationLong(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s} s`;
  return s ? `${m} min ${s.toString().padStart(2, '0')}` : `${m} min`;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function formatDate(iso?: string): string {
  return iso ? dateFmt.format(new Date(iso)) : '';
}

export function formatDateTime(iso?: string): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : '';
}

export function formatBytes(n?: number): string {
  if (n === undefined) return '—';
  if (n < 1024) return `${n} o`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} Ko`;
  const fr = (x: number, d: number) => x.toLocaleString('fr-FR', { maximumFractionDigits: d });
  if (n < 1024 ** 3) return `${fr(n / 1024 ** 2, 1)} Mo`;
  return `${fr(n / 1024 ** 3, 1)} Go`;
}

/** Normalise un texte pour la recherche (minuscules, sans accents). */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function isSafeUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
