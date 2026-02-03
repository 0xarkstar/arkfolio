import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsLargeDesktop,
  usePrefersReducedMotion,
  usePrefersDarkMode,
  usePrefersLightMode,
} from '../useMediaQuery';

describe('useMediaQuery', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();

    matchMediaMock = vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useMediaQuery hook', () => {
    it('should return false by default', () => {
      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(result.current).toBe(false);
    });

    it('should return true when media query matches', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        media: '(min-width: 768px)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(result.current).toBe(true);
    });

    it('should add event listener on mount', () => {
      renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should remove event listener on unmount', () => {
      const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      unmount();

      expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('should update when media query changes', () => {
      let changeHandler: (e: { matches: boolean }) => void = () => {};

      addEventListenerMock.mockImplementation((_event: string, handler: (e: { matches: boolean }) => void) => {
        changeHandler = handler;
      });

      const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));

      expect(result.current).toBe(false);

      act(() => {
        changeHandler({ matches: true });
      });

      expect(result.current).toBe(true);
    });

    it('should re-evaluate when query changes', () => {
      const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
        initialProps: { query: '(min-width: 768px)' },
      });

      expect(matchMediaMock).toHaveBeenCalledWith('(min-width: 768px)');

      rerender({ query: '(min-width: 1024px)' });

      expect(matchMediaMock).toHaveBeenCalledWith('(min-width: 1024px)');
    });
  });

  describe('useIsMobile', () => {
    it('should return true when screen is below 640px', () => {
      matchMediaMock.mockReturnValue({
        matches: false, // Not matching min-width: 640px = is mobile
        media: '(min-width: 640px)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('should return false when screen is 640px or above', () => {
      matchMediaMock.mockReturnValue({
        matches: true, // Matching min-width: 640px = not mobile
        media: '(min-width: 640px)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe('useIsTablet', () => {
    it('should return true for tablet-sized screens', () => {
      matchMediaMock.mockImplementation((query: string) => ({
        matches: query === '(min-width: 640px)', // Between 640px and 1024px
        media: query,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      }));

      const { result } = renderHook(() => useIsTablet());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsDesktop', () => {
    it('should return true when screen is 1024px or above', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        media: '(min-width: 1024px)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => useIsDesktop());

      expect(result.current).toBe(true);
    });

    it('should return false when screen is below 1024px', () => {
      matchMediaMock.mockReturnValue({
        matches: false,
        media: '(min-width: 1024px)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => useIsDesktop());

      expect(result.current).toBe(false);
    });
  });

  describe('useIsLargeDesktop', () => {
    it('should return true when screen is 1280px or above', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        media: '(min-width: 1280px)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => useIsLargeDesktop());

      expect(result.current).toBe(true);
    });
  });

  describe('usePrefersReducedMotion', () => {
    it('should return true when user prefers reduced motion', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(true);
    });

    it('should return false when user does not prefer reduced motion', () => {
      matchMediaMock.mockReturnValue({
        matches: false,
        media: '(prefers-reduced-motion: reduce)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(false);
    });
  });

  describe('usePrefersDarkMode', () => {
    it('should return true when user prefers dark mode', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => usePrefersDarkMode());

      expect(result.current).toBe(true);
    });
  });

  describe('usePrefersLightMode', () => {
    it('should return true when user prefers light mode', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        media: '(prefers-color-scheme: light)',
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      });

      const { result } = renderHook(() => usePrefersLightMode());

      expect(result.current).toBe(true);
    });
  });
});
