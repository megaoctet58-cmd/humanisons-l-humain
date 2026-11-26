/** La charte éthique. */
const ITEMS = [
  'L’humain avant le profit.',
  'L’écoute avant le jugement.',
  'Les faits avant les manipulations.',
  'L’empathie avant la confrontation.',
  'La réflexion avant la réaction.',
  'La dignité avant la popularité.',
  'La liberté d’expression dans le respect d’autrui.',
  'La technologie au service de l’humain, et non l’inverse.',
  'Le refus de monétiser l’attention et la souffrance.',
  'La conviction qu’un autre fonctionnement de notre société est possible.',
];

export function Charter() {
  return (
    <article className="page narrow prose">
      <p className="kicker">La charte éthique</p>
      <h1>Ce qui nous engage</h1>
      <ol className="charter">
        {ITEMS.map((t, i) => (
          <li key={i}>
            <span className="charter__n">{String(i + 1).padStart(2, '0')}</span>
            <span>{t}</span>
          </li>
        ))}
      </ol>
      <h2>Règles de modération</h2>
      <ul>
        <li>Les sources des actualités sont vérifiées ; les faits sont distingués des opinions.</li>
        <li>Les accusations visant des entreprises ou des personnes font l’objet d’une attention particulière.</li>
        <li>Insultes, harcèlement et contenus haineux sont refusés.</li>
        <li>Les données personnelles des tiers sont protégées ; les enregistrements non autorisés de tiers sont refusés.</li>
        <li>Les publicités déguisées et les contenus manifestement manipulés sont refusés.</li>
        <li>Un témoignage accepté n’est pas présenté comme un fait vérifié.</li>
        <li>Les corrections importantes sont soumises à l’auteur avant publication. Le retrait peut être demandé à tout moment.</li>
        <li>Les opinions contradictoires et les débats constructifs ont leur place : nous refusons de devenir une chambre d’écho.</li>
      </ul>
    </article>
  );
}
