/** Explorer : recherche et filtres combinés (type, catégorie, période, audio). */
import { useState } from 'react';
import { useData } from '../services/store';
import { filterPosts, usePublicPosts } from '../services/selectors';
import { PostCard } from '../components/PostCard';
import { Icon } from '../components/Icon';
import { POST_TYPES, type PostType } from '../models/types';
import { cx } from '../lib/util';

const PERIODS = [
  { days: 0, label: 'Toute période' },
  { days: 7, label: '7 derniers jours' },
  { days: 30, label: '30 derniers jours' },
  { days: 365, label: 'Cette année' },
];

export function Explore() {
  const { categories, categoryName } = useData();
  const all = usePublicPosts();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<PostType | 'tout'>('tout');
  const [categoryId, setCategoryId] = useState('');
  const [period, setPeriod] = useState(0);
  const [audioOnly, setAudioOnly] = useState(false);
  const list = filterPosts(all, { query, type, categoryId: categoryId || undefined, periodDays: period || undefined, audioOnly }, categoryName);
  const active = query || type !== 'tout' || categoryId || period || audioOnly;

  return (
    <section className="page">
      <h1 className="page__title">Explorer</h1>
      <div className="search">
        <Icon name="search" />
        <input type="search" placeholder="Rechercher un mot, un thème, une situation…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Rechercher" data-testid="search-input" />
      </div>
      <div className="pills" role="group" aria-label="Type de publication">
        <button type="button" className={cx('pill', type === 'tout' && 'is-on')} onClick={() => setType('tout')} aria-pressed={type === 'tout'}>
          Tout
        </button>
        {POST_TYPES.map((t) => (
          <button key={t.id} type="button" className={cx('pill', type === t.id && 'is-on')} onClick={() => setType(t.id)} aria-pressed={type === t.id}>
            {t.plural}
          </button>
        ))}
      </div>
      <div className="filters">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Catégorie">
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(Number(e.target.value))} aria-label="Période">
          {PERIODS.map((p) => (
            <option key={p.days} value={p.days}>
              {p.label}
            </option>
          ))}
        </select>
        <label className="check check--inline">
          <input type="checkbox" checked={audioOnly} onChange={(e) => setAudioOnly(e.target.checked)} /> Avec la voix
        </label>
      </div>
      <p className="muted small" aria-live="polite">
        {list.length} publication{list.length > 1 ? 's' : ''}
        {active ? ' correspondante' + (list.length > 1 ? 's' : '') : ''}
      </p>
      <div className="feed">
        {list.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </div>
      {list.length === 0 && <p className="empty">Rien ne correspond. Essayez d’autres mots.</p>}
    </section>
  );
}
