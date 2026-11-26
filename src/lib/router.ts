/**
 * Routeur minimal basé sur le « hash » (#/temoigner, #/publication/abc…).
 * Ce choix permet d'héberger l'application sur n'importe quel hébergement
 * statique gratuit, sans configuration serveur. Chaque publication a sa
 * propre URL partageable : #/publication/<id>.
 */
import { useEffect, useState } from 'react';

export interface Route {
  path: string; // ex. "/publication/abc"
  segments: string[]; // ["publication", "abc"]
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return { path: clean, segments: clean.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs ?? '') };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function navigate(to: string) {
  const target = `#${to.startsWith('/') ? to : `/${to}`}`;
  if (window.location.hash === target) return;
  window.location.hash = target;
}

export function postUrl(id: string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#/publication/${encodeURIComponent(id)}`;
}
