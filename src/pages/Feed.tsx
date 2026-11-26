/** Le fil humain : toutes les publications, de la plus récente à la plus ancienne. */
import { useData } from '../services/store';
import { filterPosts, usePublicPosts } from '../services/selectors';
import { PostCard } from '../components/PostCard';
import { FeedEnd } from '../components/FeedEnd';
import { POST_TYPES, type PostType } from '../models/types';
import { navigate, type Route } from '../lib/router';

export function Feed({ route }: { route: Route }) {
  const { categoryName, categories, ready } = useData();
  const all = usePublicPosts();
  const type = (route.query.get('type') as PostType | null) ?? 'tout';
  const categoryId = route.query.get('categorie') ?? '';
  const list = filterPosts(all, { type, categoryId: categoryId || undefined }, categoryName);
  const typeInfo = POST_TYPES.find((t) => t.id === type);

  const setCategory = (c: string) => {
    const q = new URLSearchParams(route.query);
    if (c) q.set('categorie', c);
    else q.delete('categorie');
    navigate(`/?${q.toString()}`);
  };

  return (
    <section className="page" aria-labelledby="feed-title">
      {type === 'tout' && !categoryId && (
        <div className="intro" data-testid="intro">
          <p className="intro__text">
            Vous avez vécu une situation où l'argent ou l'intérêt de quelques-uns a compté plus que l'humain, et vous ne comprenez toujours pas ? Ici, vous pouvez la raconter, la
            dénoncer et découvrir que vous n'êtes pas seul.
          </p>
          <a className="btn btn--sm" href="#/temoigner">
            Témoigner
          </a>
        </div>
      )}
      <div className="section-head">
        <h1 id="feed-title" className="section-head__title">
          Le fil humain
        </h1>
        <span className="section-head__aside">Du plus récent au plus ancien</span>
      </div>
      <div className="feed-tools">
        <label className="select-inline">
          <span className="sr-only">Catégorie</span>
          <select value={categoryId} onChange={(e) => setCategory(e.target.value)} aria-label="Filtrer par catégorie">
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {type !== 'tout' && typeInfo && <span className="muted small">{typeInfo.description}</span>}
      </div>

      {!ready ? (
        <p className="muted center-text">Chargement…</p>
      ) : list.length === 0 ? (
        <div className="empty">
          <p>Aucune publication ne correspond à ce filtre pour l’instant.</p>
          <a className="btn btn--ghost" href="#/temoigner">
            Témoigner
          </a>
        </div>
      ) : (
        <div className="feed">
          {list.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
      {ready && <FeedEnd />}
    </section>
  );
}
