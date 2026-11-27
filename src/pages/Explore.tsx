/** Explorer : recherche et filtres combinés (type, catégorie, période, audio), et carte par département. */
import { useEffect, useMemo, useState } from 'react';
import { useData } from '../services/store';
import { filterPosts, usePublicPosts } from '../services/selectors';
import { PostCard } from '../components/PostCard';
import { Icon } from '../components/Icon';
import { POST_TYPES, type PostType } from '../models/types';
import { cx } from '../lib/util';
import { navigate, type Route } from '../lib/router';
import * as repo from '../services/repository';
import { DepartmentMap, MapLegend, countText } from '../components/DepartmentMap';
import { DEPARTMENTS, OTHER_PLACES, departmentLabel } from '../data/departments';

const PERIODS = [
  { days: 0, label: 'Toute période' },
  { days: 7, label: '7 derniers jours' },
  { days: 30, label: '30 derniers jours' },
  { days: 365, label: 'Cette année' },
];

export function Explore({ route }: { route: Route }) {
  const map = route.query.get('vue') === 'carte';
  return (
    <section className="page">
      <h1 className="page__title">Explorer</h1>
      <div className="segmented explore-tabs" role="tablist" aria-label="Affichage">
        <button type="button" role="tab" aria-selected={!map} className={cx('segmented__opt', !map && 'is-on')} onClick={() => navigate('/explorer')}>
          Rechercher
        </button>
        <button type="button" role="tab" aria-selected={map} className={cx('segmented__opt', map && 'is-on')} onClick={() => navigate('/explorer?vue=carte')} data-testid="tab-map">
          La carte
        </button>
      </div>
      {map ? <MapView selected={route.query.get('dep') ?? undefined} /> : <Search />}
    </section>
  );
}

function MapView({ selected }: { selected?: string }) {
  const { posts } = useData();
  const all = usePublicPosts();
  const [rows, setRows] = useState<repo.DepartmentCount[] | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    repo.departmentMap().then((r) => alive && setRows(r));
    return () => {
      alive = false;
    };
  }, [posts]);

  const counts = useMemo(() => new Map((rows ?? []).map((r) => [r.code, r])), [rows]);
  const select = (code: string) => navigate(code ? `/explorer?vue=carte&dep=${encodeURIComponent(code)}` : '/explorer?vue=carte');
  const current = selected ? counts.get(selected) : undefined;
  const list = current ? all.filter((p) => current.ids.includes(p.id)) : [];
  const represented = (rows ?? []).filter((r) => DEPARTMENTS.some((d) => d.code === r.code)).length;
  const elsewhere = OTHER_PLACES.map((o) => ({ o, c: counts.get(o.code) })).filter((x) => x.c);

  return (
    <div className="map-view">
      <p className="muted">
        Chaque département est coloré selon le nombre de témoignages publiés qui en viennent. Touchez un département pour voir son nombre et lire ses témoignages.
      </p>
      {rows === null && (
        <div className="notice" data-testid="map-unavailable"><p>
          La carte se met en place : les nombres s’afficheront très bientôt.
        </p></div>
      )}
      <div className="map-view__grid">
        <div className="map-view__map">
          <DepartmentMap counts={counts} selected={selected} onSelect={select} />
          <MapLegend />
        </div>
        <div className="map-view__side">
          <label className="field">
            <span>Choisir un département</span>
            <select value={selected ?? ''} onChange={(e) => select(e.target.value)} data-testid="map-select">
              <option value="">—</option>
              {[...DEPARTMENTS, ...OTHER_PLACES].map((d) => (
                <option key={d.code} value={d.code}>
                  {departmentLabel(d.code)}
                </option>
              ))}
            </select>
          </label>
          {selected && departmentLabel(selected) && (
            <div className="map-view__info" aria-live="polite" data-testid="map-info">
              <p className="map-view__dep">{departmentLabel(selected)}</p>
              <p>{rows === null ? 'Nombre bientôt disponible.' : countText(current)}</p>
              {current && current.count === null && (
                <p className="muted small">Pour protéger l’anonymat de chacun, le nombre exact et les témoignages ne sont montrés qu’à partir de 3.</p>
              )}
            </div>
          )}
          {rows && rows.length > 0 && (
            <p className="muted small">
              {represented} département{represented > 1 ? 's' : ''} représenté{represented > 1 ? 's' : ''}
              {elsewhere.map(({ o, c }) => ` · ${o.name} : ${countText(c)}`).join('')}
            </p>
          )}
          {rows && rows.length === 0 && <p className="muted small">Aucun témoignage publié n’indique encore son département.</p>}
        </div>
      </div>
      {list.length > 0 && (
        <>
          <h2 className="h3">Les témoignages : {departmentLabel(selected)}</h2>
          <div className="feed">
            {list.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        </>
      )}
      <p className="muted small map-view__source">
        Seuls les témoignages publiés dont l’auteur a indiqué son département sont comptés. Le département n’apparaît jamais sur un témoignage. Fond de carte : IGN, Admin Express (Licence Ouverte).
      </p>
    </div>
  );
}

function Search() {
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
    <>
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
    </>
  );
}
