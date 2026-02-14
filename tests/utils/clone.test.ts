import { describe, expect, it } from 'vitest';
import { deepClone } from '../../src/utils/clone';

describe('deepClone', () => {
  describe('primitives', () => {
    it('clones numbers', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone(0)).toBe(0);
      expect(deepClone(-5)).toBe(-5);
    });

    it('clones strings', () => {
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone('')).toBe('');
    });

    it('clones booleans', () => {
      expect(deepClone(true)).toBe(true);
      expect(deepClone(false)).toBe(false);
    });

    it('clones null', () => {
      expect(deepClone(null)).toBe(null);
    });

    it('clones undefined', () => {
      expect(deepClone(undefined)).toBe(undefined);
    });
  });

  describe('arrays', () => {
    it('clones empty arrays', () => {
      const original: unknown[] = [];
      const cloned = deepClone(original);
      expect(cloned).toEqual([]);
      expect(cloned).not.toBe(original);
    });

    it('clones arrays with primitives', () => {
      const original = [1, 2, 3];
      const cloned = deepClone(original);
      expect(cloned).toEqual([1, 2, 3]);
      expect(cloned).not.toBe(original);
    });

    it('clones nested arrays', () => {
      const original = [
        [1, 2],
        [3, 4],
      ];
      const cloned = deepClone(original);
      expect(cloned).toEqual([
        [1, 2],
        [3, 4],
      ]);
      expect(cloned).not.toBe(original);
      expect(cloned[0]).not.toBe(original[0]);
    });

    it('modifications to clone do not affect original', () => {
      const original = [1, 2, 3];
      const cloned = deepClone(original);
      cloned[0] = 99;
      expect(original[0]).toBe(1);
    });
  });

  describe('objects', () => {
    it('clones empty objects', () => {
      const original = {};
      const cloned = deepClone(original);
      expect(cloned).toEqual({});
      expect(cloned).not.toBe(original);
    });

    it('clones objects with primitives', () => {
      const original = { a: 1, b: 'hello', c: true };
      const cloned = deepClone(original);
      expect(cloned).toEqual({ a: 1, b: 'hello', c: true });
      expect(cloned).not.toBe(original);
    });

    it('clones nested objects', () => {
      const original = { a: { b: { c: 1 } } };
      const cloned = deepClone(original);
      expect(cloned).toEqual({ a: { b: { c: 1 } } });
      expect(cloned).not.toBe(original);
      expect(cloned.a).not.toBe(original.a);
      expect(cloned.a.b).not.toBe(original.a.b);
    });

    it('modifications to clone do not affect original', () => {
      const original = { a: { b: 1 } };
      const cloned = deepClone(original);
      cloned.a.b = 99;
      expect(original.a.b).toBe(1);
    });
  });

  describe('mixed structures', () => {
    it('clones objects containing arrays', () => {
      const original = { arr: [1, 2, 3] };
      const cloned = deepClone(original);
      expect(cloned).toEqual({ arr: [1, 2, 3] });
      expect(cloned.arr).not.toBe(original.arr);
    });

    it('clones arrays containing objects', () => {
      const original = [{ a: 1 }, { b: 2 }];
      const cloned = deepClone(original);
      expect(cloned).toEqual([{ a: 1 }, { b: 2 }]);
      expect(cloned[0]).not.toBe(original[0]);
    });
  });
});
