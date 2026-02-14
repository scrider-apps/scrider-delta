import { describe, expect, it } from 'vitest';
import { deepEqual } from '../../src/utils/equal';

describe('deepEqual', () => {
  describe('primitives', () => {
    it('returns true for equal numbers', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual(0, 0)).toBe(true);
      expect(deepEqual(-5, -5)).toBe(true);
    });

    it('returns false for different numbers', () => {
      expect(deepEqual(1, 2)).toBe(false);
    });

    it('returns true for equal strings', () => {
      expect(deepEqual('hello', 'hello')).toBe(true);
      expect(deepEqual('', '')).toBe(true);
    });

    it('returns false for different strings', () => {
      expect(deepEqual('hello', 'world')).toBe(false);
    });

    it('returns true for equal booleans', () => {
      expect(deepEqual(true, true)).toBe(true);
      expect(deepEqual(false, false)).toBe(true);
    });

    it('returns false for different booleans', () => {
      expect(deepEqual(true, false)).toBe(false);
    });

    it('handles null', () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
      expect(deepEqual(null, 0)).toBe(false);
    });

    it('handles undefined', () => {
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(undefined, null)).toBe(false);
    });
  });

  describe('arrays', () => {
    it('returns true for equal empty arrays', () => {
      expect(deepEqual([], [])).toBe(true);
    });

    it('returns true for equal arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('returns false for arrays with different lengths', () => {
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('returns false for arrays with different values', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('handles nested arrays', () => {
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 4],
          ],
        ),
      ).toBe(true);
      expect(
        deepEqual(
          [
            [1, 2],
            [3, 4],
          ],
          [
            [1, 2],
            [3, 5],
          ],
        ),
      ).toBe(false);
    });
  });

  describe('objects', () => {
    it('returns true for equal empty objects', () => {
      expect(deepEqual({}, {})).toBe(true);
    });

    it('returns true for equal objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('returns true regardless of key order', () => {
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    });

    it('returns false for objects with different keys', () => {
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('returns false for objects with different values', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('handles nested objects', () => {
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
    });

    it('returns false when comparing object to array', () => {
      expect(deepEqual({ 0: 'a', 1: 'b' }, ['a', 'b'])).toBe(false);
    });
  });

  describe('mixed types', () => {
    it('returns false for different types', () => {
      expect(deepEqual(1, '1')).toBe(false);
      expect(deepEqual(true, 1)).toBe(false);
      expect(deepEqual({}, [])).toBe(false);
    });
  });
});
