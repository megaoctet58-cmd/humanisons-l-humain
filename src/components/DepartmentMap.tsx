/**
 * Carte des départements colorés selon le nombre de publications publiques.
 * Au-dessous de 3, le nombre exact n'est jamais connu ni affiché (« moins de 3 »).
 */
import { DEPARTMENT_PATHS, MAP_INSETS, MAP_VIEWBOX } from '../data/franceMap';
import { departmentLabel } from '../data/departments';
import type { DepartmentCount } from '../services/repository';

/** Paliers de couleur : 0, moins de 3, 3 à 5, 6 à 10, 11 à 25, plus de 25. */
export const MAP_LEVELS = [
  { label: 'Aucun', mix: 0 },
  { label: 'Moins de 3', mix: 18 },
  { label: '3 à 5', mix: 38 },
  { label: '6 à 10', mix: 58 },
  { label: '11 à 25', mix: 78 },
  { label: 'Plus de 25', mix: 100 },
];

export function levelOf(c?: DepartmentCount): number {
  if (!c) return 0;
  if (c.count === null) return 1;
  if (c.count <= 5) return 2;
  if (c.count <= 10) return 3;
  if (c.count <= 25) return 4;
  return 5;
}

export const levelColor = (level: number) =>
  level === 0 ? 'var(--map-empty)' : `color-mix(in srgb, var(--accent) ${MAP_LEVELS[level].mix}%, var(--card))`;

export function countText(c?: DepartmentCount): string {
  if (!c) return 'aucun témoignage pour l’instant';
  if (c.count === null) return 'moins de 3 témoignages';
  return `${c.count} témoignages`;
}

interface Props {
  counts: Map<string, DepartmentCount>;
  selected?: string;
  onSelect: (code: string) => void;
}

export function DepartmentMap({ counts, selected, onSelect }: Props) {
  const codes = Object.keys(DEPARTMENT_PATHS);
  return (
    <svg className="fr-map" viewBox={MAP_VIEWBOX} role="img" aria-label="Carte de France des témoignages par département" data-testid="department-map">
      {MAP_INSETS.map((b) => (
        <rect key={b.code} className="fr-map__inset" x={b.x} y={b.y} width={b.w} height={b.h} rx={6} />
      ))}
      {codes.map((code) => {
        const c = counts.get(code);
        return (
          <path
            key={code}
            d={DEPARTMENT_PATHS[code]}
            className="fr-map__dep"
            style={{ fill: levelColor(levelOf(c)) }}
            onClick={() => onSelect(code)}
            data-code={code}
          >
            <title>{`${departmentLabel(code)} : ${countText(c)}`}</title>
          </path>
        );
      })}
      {selected && DEPARTMENT_PATHS[selected] && <path d={DEPARTMENT_PATHS[selected]} className="fr-map__selected" />}
    </svg>
  );
}

export function MapLegend() {
  return (
    <ul className="fr-map__legend" aria-label="Légende">
      {MAP_LEVELS.map((l, i) => (
        <li key={l.label}>
          <span className="fr-map__swatch" style={{ background: levelColor(i) }} aria-hidden="true" /> {l.label}
        </li>
      ))}
    </ul>
  );
}
