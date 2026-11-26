/** Informations sur le prototype, la confidentialité et les mentions légales (provisoires). */
import { isRemote } from '../services/repository';

export function About() {
  return (
    <article className="page narrow prose">
      <p className="kicker">À propos de cette version</p>
      {isRemote ? (
        <>
          <h1>Version de test</h1>
          <p>
            Les publications validées par la modération sont visibles sur tous les appareils. Une contribution n’est envoyée qu’au moment où vous la soumettez : elle reste
            invisible du public tant qu’elle n’a pas été lue et validée. Vos brouillons, favoris et réactions restent uniquement dans votre navigateur.
          </p>
          <h2>Limites connues</h2>
          <ul>
            <li>Pas encore de comptes contributeurs : « Mon espace » permet de suivre les contributions envoyées depuis cet appareil.</li>
            <li>La transcription automatique n’est pas encore disponible : la transcription est saisie à la main.</li>
            <li>Les publications marquées « Exemple fictif » sont des données de démonstration, sans voix réelle.</li>
          </ul>
          <h2>Confidentialité</h2>
          <p>
            Aucune publicité, aucun traceur, aucune revente de données. Les contributions sont hébergées chez Supabase. L’adresse e-mail facultative, les justificatifs privés et
            les enregistrements dont vous n’autorisez pas la diffusion ne sont jamais accessibles publiquement : seule l’administration peut les consulter. La politique de
            confidentialité, les conditions d’utilisation et les mentions légales définitives seront rédigées avant l’ouverture au public (conformité RGPD).
          </p>
        </>
      ) : (
        <>
          <h1>Prototype V0.1</h1>
          <p>
            Cette version est un <strong>prototype local</strong>. Toutes les données (publications, enregistrements, images, brouillons, favoris) sont conservées uniquement
            dans votre navigateur, sur cet appareil. Rien n’est envoyé sur Internet.
          </p>
          <h2>Limites connues</h2>
          <ul>
            <li>Pas encore de vrais comptes : « Mon espace » correspond à cet appareil.</li>
            <li>L’administration est une démonstration locale, <strong>non sécurisée</strong> : n’importe qui utilisant ce navigateur peut y accéder.</li>
            <li>Les contributions ne sont pas partagées entre appareils : la modération se fait sur l’appareil où le témoignage a été déposé.</li>
            <li>La transcription automatique n’est pas encore disponible : la transcription est saisie à la main.</li>
            <li>Les publications marquées « Exemple fictif » sont des données de démonstration, sans voix réelle.</li>
          </ul>
          <h2>Confidentialité</h2>
          <p>
            Aucune publicité, aucun traceur, aucune revente de données. L’adresse e-mail facultative et les justificatifs privés ne sont jamais affichés publiquement. La politique de
            confidentialité, les conditions d’utilisation et les mentions légales définitives seront rédigées avant toute mise en ligne publique (conformité RGPD).
          </p>
        </>
      )}
    </article>
  );
}
