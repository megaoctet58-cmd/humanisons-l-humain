/** Page dédiée d'une publication (URL partageable). */
import { isPublic } from '../models/types';
import { useData } from '../services/store';
import { PostCard } from '../components/PostCard';
import { Icon } from '../components/Icon';

export function PostPage({ id }: { id: string }) {
  const { posts, ready } = useData();
  const post = posts.find((p) => p.id === id);
  if (!ready) return <p className="page muted">Chargement…</p>;
  if (!post || !isPublic(post)) {
    return (
      <section className="page narrow center-text">
        <h1>Publication introuvable</h1>
        <p className="muted">Elle a peut-être été retirée, ou n’est pas encore publiée.</p>
        <a className="btn" href="#/">
          Retour au fil
        </a>
      </section>
    );
  }
  return (
    <section className="page narrow">
      <a className="back" href="#/" onClick={(e) => (window.history.length > 1 ? (e.preventDefault(), window.history.back()) : undefined)}>
        <Icon name="back" size={18} /> Retour
      </a>
      <PostCard post={post} full />
    </section>
  );
}
