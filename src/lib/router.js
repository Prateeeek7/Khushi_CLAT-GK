// Tiny hash router: works on any static host (Vercel included) without rewrite rules.
import { useEffect, useState } from 'react';

export function parseHash(hash) {
  const h = (hash || '').replace(/^#\/?/, '');
  const [path, qs] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  return { name: parts[0] || 'home', params: parts.slice(1), query: new URLSearchParams(qs || '') };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path) {
  const target = '#/' + String(path).replace(/^[#/]+/, '');
  if (window.location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else window.location.hash = target;
}
