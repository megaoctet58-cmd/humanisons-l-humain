/**
 * Logo validé : petite onde sonore horizontale terracotta, titre en capitales,
 * signature dessous, alignement centré. Aucun cœur, aucun pictogramme médical.
 */
export function WaveMark({ width = 84 }: { width?: number }) {
  return (
    <svg className="logo__wave" width={width} height={width * 0.22} viewBox="0 0 84 18" fill="none" aria-hidden="true">
      <path
        d="M0 9h30l3-4 3 9 3-13 3 15 3-11 3 6 2-2h34"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'logo logo--compact' : 'logo'}>
      <WaveMark width={compact ? 56 : 84} />
      <p className="logo__title">HUMANISONS L'HUMAIN</p>
      {!compact && <p className="logo__tagline">Un réseau humain plutôt qu'un réseau social.</p>}
    </div>
  );
}
