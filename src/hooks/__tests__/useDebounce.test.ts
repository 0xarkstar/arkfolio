import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce, useDebouncedCallback } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useDebounce hook', () => {
    it('should return initial value immediately', () => {
      const { result } = renderHook(() => useDebounce('initial', 300));

      expect(result.current).toBe('initial');
    });

    it('should update value after delay', () => {
      const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
        initialProps: { value: 'initial' },
      });

      expect(result.current).toBe('initial');

      rerender({ value: 'updated' });

      // Value should not change immediately
      expect(result.current).toBe('initial');

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current).toBe('updated');
    });

    it('should use default delay of 300ms', () => {
      const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
        initialProps: { value: 'initial' },
      });

      rerender({ value: 'updated' });

      // Should not update before 300ms
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(result.current).toBe('initial');

      // Should update at 300ms
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(result.current).toBe('updated');
    });

    it('should reset timer on rapid changes', () => {
      const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
        initialProps: { value: 'v1' },
      });

      rerender({ value: 'v2' });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      rerender({ value: 'v3' });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Still showing original because timer keeps resetting
      expect(result.current).toBe('v1');

      // Wait for the full delay after last change
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe('v3');
    });

    it('should work with different types', () => {
      const { result: numberResult, rerender: rerenderNumber } = renderHook(
        ({ value }) => useDebounce(value, 100),
        { initialProps: { value: 1 } }
      );

      rerenderNumber({ value: 2 });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(numberResult.current).toBe(2);

      const { result: objectResult, rerender: rerenderObject } = renderHook(
        ({ value }) => useDebounce(value, 100),
        { initialProps: { value: { a: 1 } } }
      );

      rerenderObject({ value: { a: 2 } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(objectResult.current).toEqual({ a: 2 });
    });

    it('should respect custom delay', () => {
      const { result, rerender } = renderHook(({ value }) => useDebounce(value, 500), {
        initialProps: { value: 'initial' },
      });

      rerender({ value: 'updated' });

      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(result.current).toBe('initial');

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe('updated');
    });

    it('should cleanup timer on unmount', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { unmount, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
        initialProps: { value: 'initial' },
      });

      rerender({ value: 'updated' });
      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('useDebouncedCallback hook', () => {
    it('should debounce callback execution', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      act(() => {
        result.current('arg1');
      });

      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(callback).toHaveBeenCalledWith('arg1');
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous callback on rapid calls', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 300));

      act(() => {
        result.current('call1');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current('call2');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current('call3');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Only the last call should execute
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('call3');
    });

    it('should use default delay of 300ms', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback));

      act(() => {
        result.current();
      });

      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(callback).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(callback).toHaveBeenCalled();
    });

    it('should pass multiple arguments to callback', () => {
      const callback = vi.fn();
      const { result } = renderHook(() => useDebouncedCallback(callback, 100));

      act(() => {
        result.current('arg1', 'arg2', 'arg3');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });
});
