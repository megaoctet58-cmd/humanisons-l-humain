/**
 * Pages légales : politique de confidentialité, conditions d'utilisation, mentions légales.
 * Rédigées pour le fonctionnement réel du site (base Supabase, comptes facultatifs,
 * transcription dans le navigateur). Les informations d'identité viennent de data/legal.ts.
 */
import { LEGAL, aCompleter } from '../data/legal';

const Contact = () => (LEGAL.email ? <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : <>[adresse de contact à compléter]</>);

function Head({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="muted small">Dernière mise à jour : {LEGAL.miseAJour}</p>
    </>
  );
}

export function LegalNotice() {
  return (
    <article className="page narrow prose" data-testid="legal-notice">
      <Head kicker="Informations légales" title="Mentions légales" />
      <h2>Éditeur du site</h2>
      <p>
        Le site Humanisons l’humain est édité par : <strong>{aCompleter(LEGAL.editeur)}</strong>
        {LEGAL.immatriculation && <> ({LEGAL.immatriculation})</>}.
        <br />
        {LEGAL.adresse ? (
          <>Adresse : {LEGAL.adresse}</>
        ) : (
          <>
            L’éditeur, personne physique agissant à titre non professionnel, a choisi de ne pas rendre publique son adresse personnelle, comme le permet l’article 6 III-2 de la loi
            n° 2004-575 du 21 juin 2004 (LCEN). Ses coordonnées ont été communiquées à l’hébergeur.
          </>
        )}
        <br />
        Contact : <Contact />
      </p>
      <p>Directeur ou directrice de la publication : {aCompleter(LEGAL.directeurPublication)}.</p>
      <h2>Hébergement</h2>
      <p>
        Site : GitHub Pages, service de GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis (<a href="https://github.com">github.com</a>).
        <br />
        Base de données et fichiers (publications, contributions, enregistrements, comptes) : Supabase, Inc. (<a href="https://supabase.com">supabase.com</a>), serveurs situés dans
        l’Union européenne{LEGAL.regionDonnees ? ` (${LEGAL.regionDonnees})` : ''}.
      </p>
      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom, le logo, les textes éditoriaux (manifeste, charte) et le code du site appartiennent à l’éditeur. Chaque contribution reste la propriété de son auteur, qui accorde
        au site le droit de la publier dans les conditions prévues par les <a href="#/cgu">conditions d’utilisation</a>.
      </p>
      <h2>Signaler un contenu</h2>
      <p>
        Chaque publication comporte un bouton « Signaler ». Vous pouvez aussi écrire à <Contact /> en précisant l’adresse de la publication et le motif. Les signalements sont
        examinés par une personne.
      </p>
      <p>
        Voir aussi la <a href="#/confidentialite">politique de confidentialité</a> et les <a href="#/cgu">conditions d’utilisation</a>.
      </p>
    </article>
  );
}

export function Privacy() {
  return (
    <article className="page narrow prose" data-testid="privacy">
      <Head kicker="Vos données" title="Politique de confidentialité" />
      <p>
        Humanisons l’humain refuse de monétiser l’attention : <strong>aucune publicité, aucun traceur, aucun outil de mesure d’audience, aucune revente de données</strong>. Ce
        texte explique quelles données sont traitées, pourquoi, combien de temps, et comment exercer vos droits (RGPD).
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {aCompleter(LEGAL.editeur)}, joignable à <Contact />.
      </p>

      <h2>Sans rien faire : simple visite</h2>
      <p>
        Aucun compte n’est nécessaire pour lire et écouter. Le site n’utilise <strong>aucun cookie publicitaire ni de mesure d’audience</strong>. Il enregistre dans votre
        navigateur (stockage local) uniquement ce qui est nécessaire à son fonctionnement : thème, pseudonyme proposé, brouillons, favoris, réactions, et votre session si vous êtes
        connecté. Ces éléments, strictement nécessaires, ne demandent pas de consentement et restent sur votre appareil. Comme tout site, les hébergeurs (GitHub, Supabase) reçoivent
        techniquement votre adresse IP lors des connexions et peuvent la conserver brièvement dans leurs journaux de sécurité.
      </p>

      <h2>Quand vous témoignez</h2>
      <ul>
        <li>
          <strong>Le contenu de votre contribution</strong> (texte, enregistrement vocal, images, sources, pseudonyme ou anonymat). Il n’est visible de personne d’autre que la
          modération tant qu’il n’est pas validé. Base légale : votre consentement, que vous donnez en cochant la case prévue.
        </li>
        <li>
          <strong>Votre voix</strong> est une donnée personnelle : elle peut permettre de vous reconnaître, même sous pseudonyme. Vous choisissez si elle peut être publiée, ou
          seulement transmise à la modération avec publication de la transcription. Un enregistrement non autorisé à la diffusion n’est jamais accessible publiquement.
        </li>
        <li>
          <strong>Votre adresse e-mail (facultative) et vos justificatifs privés</strong> : seulement pour que la modération puisse vous contacter ou vérifier. Jamais affichés
          publiquement. Base légale : votre consentement.
        </li>
        <li>
          <strong>Un jeton secret</strong> conservé dans votre navigateur permet de suivre votre contribution et d’en demander le retrait sans compte. La base n’en garde qu’une
          empreinte chiffrée.
        </li>
      </ul>

      <h2>Si vous créez un compte (facultatif)</h2>
      <p>
        Adresse e-mail, mot de passe (stocké chiffré, jamais lisible, même par l’éditeur), pseudonyme, brouillons, favoris et réactions, pour les retrouver sur tous vos appareils.
        Personne d’autre que vous n’y a accès. Les réactions ne sont jamais comptées ni affichées publiquement. Base légale : l’exécution des conditions d’utilisation. Vous pouvez
        supprimer votre compte à tout moment depuis « Mon espace », onglet Profil.
      </p>

      <h2>Transcription automatique</h2>
      <p>
        Elle est réalisée <strong>dans votre navigateur</strong> : votre enregistrement n’est envoyé à aucun service de transcription. À la première utilisation, le navigateur
        télécharge un modèle public (Whisper) depuis le site Hugging Face, qui voit donc votre adresse IP à ce moment-là.
      </p>

      <h2>Qui a accès à vos données</h2>
      <p>
        Uniquement la modération du site (l’éditeur), grâce à un accès protégé par mot de passe et des règles d’accès vérifiées par la base de données elle-même. Prestataires
        techniques : Supabase, Inc. (hébergement de la base et des fichiers, serveurs dans l’Union européenne{LEGAL.regionDonnees ? `, ${LEGAL.regionDonnees}` : ''}) et GitHub,
        Inc. (hébergement des pages du site). Ces sociétés étant américaines, des transferts peuvent avoir lieu dans le cadre du Data Privacy Framework UE–États-Unis et des clauses
        contractuelles types. Aucune donnée n’est vendue ni cédée.
      </p>

      <h2>Durées de conservation</h2>
      <ul>
        <li>Publication en ligne : tant qu’elle est publiée, jusqu’à votre demande de retrait.</li>
        <li>Contribution refusée ou retirée : supprimée au plus tard 6 mois après la décision.</li>
        <li>E-mail de contact et justificatifs : conservés le temps de la modération et de la publication, supprimés avec la contribution.</li>
        <li>Compte sans connexion pendant 3 ans : supprimé, après un avertissement si une adresse valide est connue.</li>
        <li>Signalements : 1 an.</li>
        <li>Données gardées dans votre navigateur : jusqu’à ce que vous les effaciez.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez demander l’accès, la rectification, l’effacement, la limitation, la portabilité de vos données, vous opposer à leur traitement et retirer votre consentement à
        tout moment (ce qui entraîne le retrait de la publication). Écrivez à <Contact />. Réponse sous un mois. Pour une contribution envoyée sans compte, indiquez son titre et sa
        date d’envoi ; une preuve raisonnable pourra être demandée pour éviter qu’un tiers ne retire votre témoignage. Si vous estimez que vos droits ne sont pas respectés, vous
        pouvez saisir la CNIL (<a href="https://www.cnil.fr/fr/plaintes">cnil.fr</a>).
      </p>

      <h2>Âge minimum</h2>
      <p>
        Il faut avoir au moins {LEGAL.ageMinimum} ans pour contribuer ou créer un compte. En dessous, l’accord d’un titulaire de l’autorité parentale est nécessaire.
      </p>

      <h2>Sécurité</h2>
      <p>
        Connexions chiffrées (HTTPS), mots de passe chiffrés, contributions non publiées et fichiers privés protégés par des règles d’accès appliquées par la base elle-même.
        Aucune protection n’est absolue : en cas d’incident affectant vos données, vous serez informé conformément au RGPD.
      </p>
    </article>
  );
}

export function Terms() {
  return (
    <article className="page narrow prose" data-testid="terms">
      <Head kicker="Règles d’usage" title="Conditions d’utilisation" />
      <h2>1. Objet</h2>
      <p>
        Humanisons l’humain est un espace gratuit, sans publicité, où chacun peut lire, écouter et proposer des témoignages, réflexions, actualités, paradoxes et initiatives
        positives sur la place de l’humain dans notre société. Utiliser le site vaut acceptation des présentes conditions et de la <a href="#/charte">charte éthique</a>.
      </p>
      <h2>2. Accès</h2>
      <p>
        La consultation est libre et sans inscription. Le compte est facultatif. Le site est fourni tel quel, dans une version en cours de développement : il peut être
        interrompu, modifié ou fermé, notamment pour maintenance.
      </p>
      <h2>3. Contributions</h2>
      <ul>
        <li>Toute contribution est examinée par une personne avant publication. La modération peut la refuser, demander des précisions ou proposer des corrections.</li>
        <li>
          Vous garantissez être l’auteur de votre contribution, que votre témoignage est sincère, et que vous avez le droit de publier les images et sons transmis. N’enregistrez
          pas d’autres personnes sans leur accord.
        </li>
        <li>
          Ne publiez pas d’informations permettant d’identifier un tiers (nom, visage, adresse…) sans son accord. Les accusations contre des personnes ou des entreprises doivent
          pouvoir être étayées.
        </li>
        <li>
          Sont refusés : propos haineux, injurieux, diffamatoires, harcèlement, incitation à la violence, contenus illégaux, publicité déguisée, contenus manipulés ou trompeurs.
        </li>
        <li>
          Une contribution acceptée n’est pas présentée comme un fait vérifié : son niveau de vérification est indiqué. Elle exprime le point de vue de son auteur, qui en est
          responsable.
        </li>
      </ul>
      <h2>4. Droits sur votre contribution</h2>
      <p>
        Vous restez propriétaire de votre contribution. En l’envoyant, vous autorisez gratuitement l’éditeur à la reproduire et à la diffuser sur le site (et dans d’éventuels
        partages de ses publications), à la mettre en forme et, avec votre accord pour toute modification importante, à la corriger. Cette autorisation vaut pour le monde entier,
        tant que la contribution est publiée : vous pouvez y mettre fin à tout moment en demandant son retrait.
      </p>
      <h2>5. Retrait et signalement</h2>
      <p>
        Vous pouvez demander le retrait de votre contribution depuis « Mon espace » ou par e-mail, sans avoir à vous justifier. Chacun peut signaler une publication grâce au bouton
        prévu ; les signalements sont examinés par une personne.
      </p>
      <h2>6. Compte</h2>
      <p>
        Vous êtes responsable de la confidentialité de votre mot de passe. Un compte utilisé contrairement à ces conditions peut être suspendu ou supprimé. Vous pouvez le supprimer
        à tout moment depuis « Mon espace ». Mot de passe oublié : écrivez à <Contact />.
      </p>
      <h2>7. Responsabilité</h2>
      <p>
        L’éditeur modère avec soin mais ne peut garantir l’exactitude de chaque témoignage. Il agit promptement pour retirer un contenu manifestement illicite qui lui est signalé.
      </p>
      <h2>8. Évolution et droit applicable</h2>
      <p>
        Ces conditions peuvent évoluer ; la date de mise à jour figure en haut de cette page. Elles sont soumises au droit français. En cas de litige, une solution amiable sera
        recherchée avant toute action devant les tribunaux compétents.
      </p>
      <p>
        Voir aussi les <a href="#/mentions-legales">mentions légales</a> et la <a href="#/confidentialite">politique de confidentialité</a>.
      </p>
    </article>
  );
}
