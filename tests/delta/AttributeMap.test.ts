import { describe, expect, it } from 'vitest';
import { compose, diff, invert, transform } from '../../src/delta/AttributeMap';

describe('AttributeMap', () => {
  describe('compose', () => {
    it('returns undefined for both undefined', () => {
      expect(compose(undefined, undefined)).toBeUndefined();
    });

    it('returns a copy of a if b is undefined', () => {
      const a = { bold: true };
      const result = compose(a, undefined);
      expect(result).toEqual({ bold: true });
      expect(result).not.toBe(a);
    });

    it('returns filtered b if a is undefined', () => {
      expect(compose(undefined, { bold: true })).toEqual({ bold: true });
    });

    it('filters null values from b when a is undefined', () => {
      expect(compose(undefined, { bold: null })).toBeUndefined();
    });

    it('merges attributes, b overwrites a', () => {
      expect(compose({ bold: true }, { italic: true })).toEqual({
        bold: true,
        italic: true,
      });
    });

    it('b overwrites same key in a', () => {
      expect(compose({ color: 'red' }, { color: 'blue' })).toEqual({
        color: 'blue',
      });
    });

    it('null in b removes key', () => {
      expect(compose({ bold: true, italic: true }, { bold: null })).toEqual({
        italic: true,
      });
    });

    it('returns undefined if result is empty', () => {
      expect(compose({ bold: true }, { bold: null })).toBeUndefined();
    });

    it('deeply clones values', () => {
      const a = { nested: { value: 1 } };
      const result = compose(a, undefined)!;
      result.nested = { value: 2 };
      expect(a.nested.value).toBe(1);
    });
  });

  describe('diff', () => {
    it('returns undefined for both undefined', () => {
      expect(diff(undefined, undefined)).toBeUndefined();
    });

    it('returns b if a is undefined', () => {
      expect(diff(undefined, { bold: true })).toEqual({ bold: true });
    });

    it('returns null for all keys if b is undefined', () => {
      expect(diff({ bold: true, italic: true }, undefined)).toEqual({
        bold: null,
        italic: null,
      });
    });

    it('returns undefined for equal attributes', () => {
      expect(diff({ bold: true }, { bold: true })).toBeUndefined();
    });

    it('detects added keys', () => {
      expect(diff({ bold: true }, { bold: true, italic: true })).toEqual({
        italic: true,
      });
    });

    it('detects removed keys', () => {
      expect(diff({ bold: true, italic: true }, { bold: true })).toEqual({
        italic: null,
      });
    });

    it('detects changed values', () => {
      expect(diff({ color: 'red' }, { color: 'blue' })).toEqual({
        color: 'blue',
      });
    });

    it('handles complex diff', () => {
      expect(
        diff({ bold: true, color: 'red', size: 12 }, { bold: true, color: 'blue', italic: true }),
      ).toEqual({
        color: 'blue',
        size: null,
        italic: true,
      });
    });
  });

  describe('invert', () => {
    it('returns empty object for undefined attr', () => {
      expect(invert(undefined, undefined)).toEqual({});
      expect(invert(undefined, { bold: true })).toEqual({});
    });

    it('removes added attribute (sets to null)', () => {
      expect(invert({ bold: true }, undefined)).toEqual({ bold: null });
    });

    it('restores removed attribute', () => {
      expect(invert({ bold: null }, { bold: true })).toEqual({ bold: true });
    });

    it('restores changed attribute', () => {
      expect(invert({ color: 'blue' }, { color: 'red' })).toEqual({
        color: 'red',
      });
    });

    it('handles no change (same value)', () => {
      expect(invert({ bold: true }, { bold: true })).toEqual({});
    });

    it('handles complex inversion', () => {
      expect(
        invert({ bold: true, color: 'blue', italic: null }, { color: 'red', italic: true }),
      ).toEqual({
        bold: null,
        color: 'red',
        italic: true,
      });
    });
  });

  describe('transform', () => {
    it('returns undefined for both undefined', () => {
      expect(transform(undefined, undefined, true)).toBeUndefined();
      expect(transform(undefined, undefined, false)).toBeUndefined();
    });

    it('returns b unchanged if a is undefined', () => {
      expect(transform(undefined, { bold: true }, true)).toEqual({ bold: true });
      expect(transform(undefined, { bold: true }, false)).toEqual({ bold: true });
    });

    it('returns undefined if b is undefined', () => {
      expect(transform({ bold: true }, undefined, true)).toBeUndefined();
      expect(transform({ bold: true }, undefined, false)).toBeUndefined();
    });

    it('returns b unchanged if priority is true (b wins)', () => {
      expect(transform({ bold: true }, { bold: false }, true)).toEqual({
        bold: false,
      });
    });

    it('filters conflicting keys if priority is false (a wins)', () => {
      expect(transform({ bold: true }, { bold: false }, false)).toBeUndefined();
    });

    it('keeps non-conflicting keys when priority is false', () => {
      expect(transform({ bold: true }, { bold: false, italic: true }, false)).toEqual({
        italic: true,
      });
    });

    it('handles no conflict', () => {
      expect(transform({ bold: true }, { italic: true }, true)).toEqual({ italic: true });
      expect(transform({ bold: true }, { italic: true }, false)).toEqual({ italic: true });
    });
  });
});
