/** Les voix humaines : les témoignages qui disposent d'un enregistrement audio. */
import { usePublicPosts } from '../services/selectors';
import { PostCard } from '../components/PostCard';
import { FeedEnd } from '../components/FeedEnd';

export function Voices() {
  const list = usePublicPosts().filter((p) => p.audio && p.audio.publishVoice);
  return (
    <section className="page">
      <h1 className="page__title">Les voix humaines</h1>
      <p className="lead">
        L’intonation fait partie du témoignage. Ici, chaque histoire se transmet aussi par une vraie voix. Rien ne se lance tout seul : appuyez sur lecture quand vous êtes prêt·e à écouter.
      </p>
      {list.length === 0 ? (
        <p className="empty">Aucun témoignage vocal publié pour l’instant.</p>
      ) : (
        <div className="feed">
          {list.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
      <FeedEnd />
    </section>
  );
}
