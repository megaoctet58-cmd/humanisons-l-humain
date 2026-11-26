/** Le manifeste officiel du projet. */
import { WaveMark } from '../components/Logo';
import { useData } from '../services/store';

export function Manifesto() {
  const { settings } = useData();
  return (
    <article className="page narrow prose">
      <p className="kicker">Le manifeste</p>
      <h1>Humanisons l’humain</h1>
      <p className="lead">Nous n’avons jamais disposé d’autant de moyens pour communiquer, produire, apprendre et améliorer nos conditions de vie.</p>
      <p>Pourtant, dans un monde toujours plus connecté, optimisé et rentable, l’humain semble parfois devenir une variable d’ajustement.</p>
      <p className="litany">
        Notre temps devient une marchandise.
        <br />
        Notre attention devient un produit.
        <br />
        Notre travail devient un indicateur.
        <br />
        Nos relations deviennent des transactions.
      </p>
      <p className="question">Mais est-ce réellement le monde que nous souhaitons construire ?</p>
      <p>
        Humanisons l’humain est né d’un besoin de conserver une trace de ces absurdités du quotidien, de ces contradictions et de ces situations que nous finissons trop souvent par
        accepter comme normales.
      </p>
      <p>Ce projet n’a pas vocation à rejeter le progrès, l’entreprise, la technologie ou l’économie. Il souhaite simplement interroger la place que nous leur accordons.</p>
      <p className="question">L’économie doit-elle être au service de l’humain, ou l’humain au service de l’économie ?</p>
      <p className="motto">Observer. Questionner. Réfléchir. Ne pas s’habituer.</p>
      <p>Et surtout, ne jamais oublier ce qui fait de nous des êtres humains.</p>
      <div className="center-text signature-block">
        <WaveMark />
        <p className="founder-sign">{settings.founderName}, fondateur</p>
        <p className="small muted">Observer · Écouter · Questionner · Humaniser</p>
      </div>
      <h2>Un réseau humain plutôt qu’un réseau social</h2>
      <ul>
        <li>Aucun algorithme pour vous retenir, aucun mécanisme addictif.</li>
        <li>Un fil chronologique, qui s’arrête. Pas de classement par popularité.</li>
        <li>Aucun compteur d’abonnés, aucune course aux likes, aucune publicité.</li>
        <li>Aucune revente de données. Aucune lecture automatique des audios.</li>
        <li>Chaque contribution extérieure est lue par une personne avant publication.</li>
        <li>Consultation libre, sans inscription.</li>
      </ul>
      <p>
        <a href="#/charte">Lire la charte éthique →</a>
      </p>
    </article>
  );
}
