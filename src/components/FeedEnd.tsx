/** Fin du fil : pas de défilement infini. */
import { WaveMark } from './Logo';

export function FeedEnd() {
  return (
    <div className="feed-end" data-testid="feed-end">
      <WaveMark width={64} />
      <p className="feed-end__title">Vous êtes à jour.</p>
      <p>Il n’y a rien de plus à faire défiler pour aujourd’hui.</p>
      <p className="feed-end__quote">Le monde réel vous attend. Prenez le temps de le vivre, de l’observer et de l’humaniser.</p>
    </div>
  );
}
