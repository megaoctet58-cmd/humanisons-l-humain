/** Sélections de publications (fil chronologique, recherche…). Aucun tri par popularité. */
import { useMemo } from 'react';
import { isPublic, publicDate, type Post, type PostType } from '../models/types';
import { useData } from './store';
import { normalize } from '../lib/util';

export function usePublicPosts(): Post[] {
  const { posts } = useData();
  return useMemo(
    () => posts.filter((p) => isPublic(p)).sort((a, b) => publicDate(b).localeCompare(publicDate(a))),
    [posts],
  );
}

export interface PostFilter {
  type?: PostType | 'tout';
  categoryId?: string;
  query?: string;
  periodDays?: number;
  audioOnly?: boolean;
}

export function filterPosts(list: Post[], f: PostFilter, categoryName: (id: string) => string): Post[] {
  const q = f.query ? normalize(f.query.trim()) : '';
  const since = f.periodDays ? Date.now() - f.periodDays * 86400_000 : 0;
  return list.filter((p) => {
    if (f.type && f.type !== 'tout' && p.type !== f.type) return false;
    if (f.categoryId && p.categoryId !== f.categoryId) return false;
    if (f.audioOnly && !(p.audio && p.audio.publishVoice)) return false;
    if (since && new Date(publicDate(p)).getTime() < since) return false;
    if (q) {
      const hay = normalize(
        [p.title, p.text, p.reflection, p.promise, p.reality, p.transcription, p.anonymous ? '' : p.authorName, categoryName(p.categoryId)]
          .filter(Boolean)
          .join(' '),
      );
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}
