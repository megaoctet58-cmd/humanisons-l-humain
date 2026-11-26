/** Informations sur le prototype, la confidentialité et les mentions légales (provisoires). */
export function About() {
  return (
    <article className="page narrow prose">
      <p className="kicker">À propos de cette version</p>
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
    </article>
  );
}
