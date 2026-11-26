import type { Category } from '../models/types';

/** Catégories initiales. Le fondateur peut les modifier depuis l'administration. */
export const DEFAULT_CATEGORIES: Category[] = [
  'Le travail',
  "L'argent avant tout",
  'Le capitalisme et la rentabilité',
  'La technologie',
  'La santé',
  'La consommation',
  'Les relations humaines',
  'Les services du quotidien',
  'Les injustices',
  "L'environnement",
  'Mon quotidien',
  "Les lueurs d'espoir",
].map((name, order) => ({ id: `cat_${order + 1}`, name, order }));
