/**
 * État partagé de l'application (lecture des données locales + rafraîchissement
 * automatique à chaque modification, y compris depuis un autre onglet).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Category, Post, ReactionId, Settings } from '../models/types';
import * as repo from './repository';
import { ensureSeeded } from '../data/demo';
import { requestPersistence } from './db';

interface DataState {
  ready: boolean;
  error?: string;
  posts: Post[];
  categories: Category[];
  favorites: string[];
  reactions: Record<string, ReactionId[]>;
  settings: Settings;
  categoryName: (id: string) => string;
  reload: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

let initPromise: Promise<void> | null = null;
function init() {
  if (!initPromise) {
    initPromise = ensureSeeded().then(() => {
      requestPersistence();
    });
  }
  return initPromise;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<DataState, 'categoryName' | 'reload'>>({
    ready: false,
    posts: [],
    categories: [],
    favorites: [],
    reactions: {},
    settings: { founderName: 'Jérémy', maxAudioSeconds: 300 },
  });

  const lastLoad = useRef(0);
  const reload = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const [posts, categories, favorites, reactions, settings] = await Promise.all([
        repo.listPosts(),
        repo.getCategories(),
        repo.getFavorites(),
        repo.getMyReactions(),
        repo.getSettings(),
      ]);
      setState({ ready: true, error: undefined, posts, categories, favorites, reactions, settings });
    } catch (e) {
      setState((s) => ({ ...s, ready: true, error: e instanceof Error ? e.message : String(e) }));
    }
  }, []);

  useEffect(() => {
    let alive = true;
    init()
      .catch((e) => setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) })))
      .finally(() => alive && reload());
    const unsub = repo.subscribe(() => reload());
    // Les publications programmées apparaissent d'elles-mêmes à l'heure prévue.
    // Base partagée : on relit aussi régulièrement et au retour sur l'onglet,
    // pour voir ce qui a été publié depuis un autre appareil.
    const timer = window.setInterval(() => {
      if (!alive) return;
      if (repo.isRemote && document.visibilityState === 'visible') reload();
      else setState((s) => ({ ...s }));
    }, 60_000);
    const onVisible = () => alive && repo.isRemote && document.visibilityState === 'visible' && reload();
    // En changeant de page dans le site, on relit si la dernière lecture date de plus de 3 s.
    const onNavigate = () => alive && repo.isRemote && Date.now() - lastLoad.current > 3_000 && reload();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('hashchange', onNavigate);
    return () => {
      alive = false;
      unsub();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('hashchange', onNavigate);
    };
  }, [reload]);

  const value = useMemo<DataState>(() => {
    const names = new Map(state.categories.map((c) => [c.id, c.name]));
    return { ...state, reload, categoryName: (id) => names.get(id) ?? 'Sans catégorie' };
  }, [state, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useData doit être utilisé dans <DataProvider>.');
  return v;
}
