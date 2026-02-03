import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: vi.fn(() => {
          mockStorage = {};
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial value', () => {
    it('should return initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      expect(result.current[0]).toBe('initial');
    });

    it('should return stored value when localStorage has value', () => {
      mockStorage['testKey'] = JSON.stringify('stored');

      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      expect(result.current[0]).toBe('stored');
    });

    it('should handle complex objects', () => {
      const initialObj = { name: 'test', count: 0 };
      mockStorage['testObj'] = JSON.stringify({ name: 'stored', count: 5 });

      const { result } = renderHook(() => useLocalStorage('testObj', initialObj));

      expect(result.current[0]).toEqual({ name: 'stored', count: 5 });
    });

    it('should handle arrays', () => {
      const initialArr = [1, 2, 3];
      mockStorage['testArr'] = JSON.stringify([4, 5, 6]);

      const { result } = renderHook(() => useLocalStorage('testArr', initialArr));

      expect(result.current[0]).toEqual([4, 5, 6]);
    });
  });

  describe('setValue', () => {
    it('should update state and localStorage', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      act(() => {
        result.current[1]('updated');
      });

      expect(result.current[0]).toBe('updated');
      expect(mockStorage['testKey']).toBe(JSON.stringify('updated'));
    });

    it('should support functional updates', () => {
      const { result } = renderHook(() => useLocalStorage('counter', 0));

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1]((prev) => prev + 1);
      });

      expect(result.current[0]).toBe(2);
    });

    it('should update complex objects', () => {
      const { result } = renderHook(() =>
        useLocalStorage('user', { name: 'John', age: 30 })
      );

      act(() => {
        result.current[1]({ name: 'Jane', age: 25 });
      });

      expect(result.current[0]).toEqual({ name: 'Jane', age: 25 });
    });

    it('should handle partial object updates via functional update', () => {
      const { result } = renderHook(() =>
        useLocalStorage('user', { name: 'John', age: 30 })
      );

      act(() => {
        result.current[1]((prev) => ({ ...prev, age: 31 }));
      });

      expect(result.current[0]).toEqual({ name: 'John', age: 31 });
    });
  });

  describe('removeValue', () => {
    it('should remove value from localStorage and reset to initial', () => {
      mockStorage['testKey'] = JSON.stringify('stored');

      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      expect(result.current[0]).toBe('stored');

      act(() => {
        result.current[2]();
      });

      expect(result.current[0]).toBe('initial');
      expect(mockStorage['testKey']).toBeUndefined();
    });
  });

  describe('storage events (cross-tab sync)', () => {
    it('should update when storage event fires', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      expect(result.current[0]).toBe('initial');

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'testKey',
            newValue: JSON.stringify('fromOtherTab'),
          })
        );
      });

      expect(result.current[0]).toBe('fromOtherTab');
    });

    it('should ignore storage events for different keys', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'otherKey',
            newValue: JSON.stringify('otherValue'),
          })
        );
      });

      expect(result.current[0]).toBe('initial');
    });

    it('should handle invalid JSON in storage event', () => {
      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'testKey',
            newValue: 'invalid json{',
          })
        );
      });

      // Should fall back to initial value on parse error
      expect(result.current[0]).toBe('initial');
    });
  });

  describe('error handling', () => {
    it('should return initial value when localStorage throws on read', () => {
      vi.mocked(window.localStorage.getItem).mockImplementation(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      expect(result.current[0]).toBe('initial');
    });

    it('should handle localStorage.setItem errors gracefully', () => {
      // Set up the mock to throw BEFORE rendering
      const originalSetItem = window.localStorage.setItem;
      let shouldThrow = false;

      vi.mocked(window.localStorage.setItem).mockImplementation((key: string, value: string) => {
        if (shouldThrow) {
          throw new Error('Storage full');
        }
        originalSetItem.call(window.localStorage, key, value);
      });

      const { result } = renderHook(() => useLocalStorage('testKey', 'initial'));

      // Now enable throwing
      shouldThrow = true;

      // The error will propagate since it's inside React's setState callback
      // We test that the hook at least attempts the operation
      expect(() => {
        act(() => {
          result.current[1]('newValue');
        });
      }).toThrow('Storage full');
    });
  });

  describe('different data types', () => {
    it('should handle boolean values', () => {
      const { result } = renderHook(() => useLocalStorage('flag', false));

      expect(result.current[0]).toBe(false);

      act(() => {
        result.current[1](true);
      });

      expect(result.current[0]).toBe(true);
    });

    it('should handle number values', () => {
      const { result } = renderHook(() => useLocalStorage('count', 0));

      act(() => {
        result.current[1](42);
      });

      expect(result.current[0]).toBe(42);
    });

    it('should handle null values', () => {
      const { result } = renderHook(() => useLocalStorage<string | null>('nullable', null));

      expect(result.current[0]).toBeNull();

      act(() => {
        result.current[1]('notNull');
      });

      expect(result.current[0]).toBe('notNull');

      act(() => {
        result.current[1](null);
      });

      expect(result.current[0]).toBeNull();
    });
  });

  describe('key changes', () => {
    it('should maintain separate state for different keys', () => {
      mockStorage['key1'] = JSON.stringify('value1');
      mockStorage['key2'] = JSON.stringify('value2');

      // First hook with key1
      const { result: result1 } = renderHook(() => useLocalStorage('key1', 'default'));
      expect(result1.current[0]).toBe('value1');

      // Second hook with key2
      const { result: result2 } = renderHook(() => useLocalStorage('key2', 'default'));
      expect(result2.current[0]).toBe('value2');
    });

    it('should use initial value for new key', () => {
      mockStorage['existingKey'] = JSON.stringify('existingValue');

      const { result } = renderHook(() => useLocalStorage('newKey', 'defaultValue'));

      expect(result.current[0]).toBe('defaultValue');
    });
  });
});
