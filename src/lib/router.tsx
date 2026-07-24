import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
  type AnchorHTMLAttributes,
} from 'react';

/**
 * Minimal History API tabanlı SPA router.
 * - GitHub Pages uyumludur (bkz. public/404.html + index.html redirect script'i).
 * - Harici bağımlılık gerektirmez, mevcut mimariye dokunmaz.
 * - Route pattern'leri `:param` ve `*` (catch-all) destekler.
 */

export const BASE_PATH = normalizeBase(import.meta.env.BASE_URL ?? '/');

function normalizeBase(base: string): string {
  if (!base || base === '/') return '';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

/** Tarayıcı adres çubuğundaki tam path'ten uygulama base'ini çıkarır. */
export function toAppPath(fullPath: string): string {
  let path = fullPath;
  if (BASE_PATH && path.startsWith(BASE_PATH)) {
    path = path.slice(BASE_PATH.length);
  }
  if (!path.startsWith('/')) path = `/${path}`;
  // Sondaki "/" karakterini kaldır (kök hariç)
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

/** Uygulama içi path'i tarayıcı için tam (base dahil) path'e çevirir. */
export function toFullPath(appPath: string): string {
  const clean = appPath.startsWith('/') ? appPath : `/${appPath}`;
  return `${BASE_PATH}${clean}`;
}

interface RouterContextValue {
  path: string;
  search: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

const RouterContext = createContext<RouterContextValue | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => toAppPath(window.location.pathname));
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(toAppPath(window.location.pathname));
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    const [rawPath, rawSearch = ''] = to.split('?');
    const full = toFullPath(rawPath);
    const fullWithSearch = rawSearch ? `${full}?${rawSearch}` : full;
    if (opts?.replace) {
      window.history.replaceState({}, '', fullWithSearch);
    } else {
      window.history.pushState({}, '', fullWithSearch);
    }
    setPath(toAppPath(rawPath));
    setSearch(rawSearch ? `?${rawSearch}` : '');
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ path, search, navigate }), [path, search, navigate]);

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter, RouterProvider içinde kullanılmalı');
  return ctx;
}

/** `/u/:username` gibi bir pattern'i verilen path'e karşı eşleştirir. */
export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);

  if (pattern.includes('*')) {
    const wildcardIndex = patternParts.indexOf('*');
    if (pathParts.length < wildcardIndex) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < wildcardIndex; i++) {
      const pp = patternParts[i];
      if (pp.startsWith(':')) params[pp.slice(1)] = decodeURIComponent(pathParts[i] ?? '');
      else if (pp !== pathParts[i]) return null;
    }
    params['*'] = pathParts.slice(wildcardIndex).join('/');
    return params;
  }

  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i];
    if (pp.startsWith(':')) {
      params[pp.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (pp !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

/** İlk eşleşen route'u döndürür. */
export function resolveRoute<T extends { pattern: string }>(
  routes: T[],
  path: string,
): { route: T; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchRoute(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; replace?: boolean };

/** Normal <a> gibi davranan ama History API ile yönlendiren link bileşeni. */
export function Link({ to, replace, onClick, children, ...rest }: LinkProps) {
  const { navigate } = useRouter();
  return (
    <a
      href={toFullPath(to)}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
