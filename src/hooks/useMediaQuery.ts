import { useState, useEffect } from 'react';

/**
 * Hook to check if a media query matches
 * @param query CSS media query string (e.g., '(min-width: 768px)')
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    // Use addEventListener for modern browsers
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

// Pre-defined breakpoint hooks (matching Tailwind defaults)
export function useIsMobile(): boolean {
  return !useMediaQuery('(min-width: 640px)');
}

export function useIsTablet(): boolean {
  return useMediaQuery('(min-width: 640px)') && !useMediaQuery('(min-width: 1024px)');
}

export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

export function useIsLargeDesktop(): boolean {
  return useMediaQuery('(min-width: 1280px)');
}

// Prefer reduced motion hook
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

// Prefer color scheme hooks
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

export function usePrefersLightMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: light)');
}
