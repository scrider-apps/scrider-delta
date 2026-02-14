import { describe, expect, it } from 'vitest';
import { Delta } from '../../src/delta/Delta';
import { compose } from '../../src/transform/compose';

describe('compose', () => {
  describe('basic operations', () => {
    it('should compose insert + insert', () => {
      const a = new Delta().insert('A');
      const b = new Delta().insert('B');
      const result = compose(a, b);

      // B inserts first, then A's content
      expect(result.ops).toEqual([{ insert: 'BA' }]);
    });

    it('should compose insert + retain', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().retain(5);
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'Hello' }]);
    });

    it('should compose insert + delete', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().delete(5);
      const result = compose(a, b);

      // Insert then delete cancels out
      expect(result.ops).toEqual([]);
    });

    it('should compose retain + insert', () => {
      const a = new Delta().retain(5);
      const b = new Delta().insert('World');
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'World' }]);
    });

    it('should compose retain + retain', () => {
      const a = new Delta().retain(5);
      const b = new Delta().retain(5);
      const result = compose(a, b);

      // Trailing retains are chopped
      expect(result.ops).toEqual([]);
    });

    it('should compose retain + delete', () => {
      const a = new Delta().retain(5);
      const b = new Delta().delete(5);
      const result = compose(a, b);

      expect(result.ops).toEqual([{ delete: 5 }]);
    });

    it('should compose delete + insert', () => {
      const a = new Delta().delete(5);
      const b = new Delta().insert('Hello');
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'Hello' }, { delete: 5 }]);
    });

    it('should compose delete + retain', () => {
      const a = new Delta().delete(5);
      const b = new Delta().retain(5);
      const result = compose(a, b);

      expect(result.ops).toEqual([{ delete: 5 }]);
    });

    it('should compose delete + delete', () => {
      const a = new Delta().delete(3);
      const b = new Delta().delete(2);
      const result = compose(a, b);

      expect(result.ops).toEqual([{ delete: 5 }]);
    });
  });

  describe('with attributes', () => {
    it('should compose insert + retain with attributes', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().retain(5, { bold: true });
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'Hello', attributes: { bold: true } }]);
    });

    it('should compose retain with different attributes', () => {
      const a = new Delta().retain(5, { bold: true });
      const b = new Delta().retain(5, { italic: true });
      const result = compose(a, b);

      expect(result.ops).toEqual([{ retain: 5, attributes: { bold: true, italic: true } }]);
    });

    it('should compose retain and remove attribute with null', () => {
      const a = new Delta().retain(5, { bold: true });
      const b = new Delta().retain(5, { bold: null });
      const result = compose(a, b);

      // bold: null removes the attribute, result is plain retain (chopped)
      expect(result.ops).toEqual([]);
    });

    it('should compose insert with attributes + retain with attributes', () => {
      const a = new Delta().insert('Hello', { bold: true });
      const b = new Delta().retain(5, { italic: true });
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'Hello', attributes: { bold: true, italic: true } }]);
    });
  });

  describe('complex operations', () => {
    it('should compose partial operations', () => {
      // Document: "Hello World"
      // A: Insert "!" after "Hello"
      // B: Delete "World"
      const a = new Delta().retain(5).insert('!');
      const b = new Delta().retain(6).delete(5);
      const result = compose(a, b);

      expect(result.ops).toEqual([{ retain: 5 }, { insert: '!' }, { delete: 5 }]);
    });

    it('should compose overlapping operations', () => {
      // A inserts "AB"
      // B deletes 1 char, retains 1
      const a = new Delta().insert('AB');
      const b = new Delta().delete(1).retain(1);
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'B' }]);
    });

    it('should compose multiple operations', () => {
      const a = new Delta().insert('Hello').retain(5).delete(3);
      const b = new Delta().retain(5).insert(' World').retain(2);
      const result = compose(a, b);

      // b.retain(5) consumes a.insert('Hello')
      // b.insert(' World') is added (merged with 'Hello' by compaction)
      // b.retain(2) consumes part of a.retain(5), leaving retain(3) -> merged to retain(5)
      // a.delete(3) passes through
      expect(result.ops).toEqual([{ insert: 'Hello World' }, { retain: 5 }, { delete: 3 }]);
    });
  });

  describe('embeds', () => {
    it('should compose insert embed + retain', () => {
      const a = new Delta().insert({ image: 'url' });
      const b = new Delta().retain(1);
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: { image: 'url' } }]);
    });

    it('should compose insert embed + retain with attributes', () => {
      const a = new Delta().insert({ image: 'url' });
      const b = new Delta().retain(1, { alt: 'description' });
      const result = compose(a, b);

      expect(result.ops).toEqual([
        { insert: { image: 'url' }, attributes: { alt: 'description' } },
      ]);
    });

    it('should compose insert embed + delete', () => {
      const a = new Delta().insert({ image: 'url' });
      const b = new Delta().delete(1);
      const result = compose(a, b);

      expect(result.ops).toEqual([]);
    });
  });

  describe('Delta.compose method', () => {
    it('should work as instance method', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().retain(5).insert(' World');
      const result = a.compose(b);

      expect(result.ops).toEqual([{ insert: 'Hello World' }]);
    });
  });

  describe('empty deltas', () => {
    it('should compose with empty delta on left', () => {
      const a = new Delta();
      const b = new Delta().insert('Hello');
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'Hello' }]);
    });

    it('should compose with empty delta on right', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta();
      const result = compose(a, b);

      expect(result.ops).toEqual([{ insert: 'Hello' }]);
    });

    it('should compose two empty deltas', () => {
      const a = new Delta();
      const b = new Delta();
      const result = compose(a, b);

      expect(result.ops).toEqual([]);
    });
  });
});
