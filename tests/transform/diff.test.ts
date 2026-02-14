import { describe, expect, it } from 'vitest';
import { Delta } from '../../src/delta/Delta';
import { diff } from '../../src/transform/diff';

describe('diff', () => {
  describe('equal documents', () => {
    it('should return empty delta for identical documents', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('Hello World');
      const result = diff(a, b);

      expect(result.ops).toEqual([]);
    });

    it('should return empty delta for empty documents', () => {
      const a = new Delta();
      const b = new Delta();
      const result = diff(a, b);

      expect(result.ops).toEqual([]);
    });
  });

  describe('insertions', () => {
    it('should detect insertion at beginning', () => {
      const a = new Delta().insert('World');
      const b = new Delta().insert('Hello World');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ insert: 'Hello ' }]);
    });

    it('should detect insertion at end', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().insert('Hello World');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5 }, { insert: ' World' }]);
    });

    it('should detect insertion in middle', () => {
      const a = new Delta().insert('HelloWorld');
      const b = new Delta().insert('Hello World');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5 }, { insert: ' ' }]);
    });
  });

  describe('deletions', () => {
    it('should detect deletion at beginning', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('World');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ delete: 6 }]);
    });

    it('should detect deletion at end', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('Hello');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5 }, { delete: 6 }]);
    });

    it('should detect deletion in middle', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('HelloWorld');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5 }, { delete: 1 }]);
    });
  });

  describe('replacements', () => {
    it('should detect simple replacement', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().insert('World');
      const result = diff(a, b);

      // fast-diff does character-level diffing, so it may find common chars
      // The important property is: compose(a, diff(a, b)) === b
      const composed = a.compose(result);
      expect(JSON.stringify(composed.ops)).toEqual(JSON.stringify(b.ops));
    });

    it('should detect partial replacement', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('Hello Earth');
      const result = diff(a, b);

      // fast-diff does character-level diffing
      // The important property is: compose(a, diff(a, b)) === b
      const composed = a.compose(result);
      expect(JSON.stringify(composed.ops)).toEqual(JSON.stringify(b.ops));
    });
  });

  describe('with attributes', () => {
    it('should detect attribute addition', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().insert('Hello', { bold: true });
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5, attributes: { bold: true } }]);
    });

    it('should detect attribute removal', () => {
      const a = new Delta().insert('Hello', { bold: true });
      const b = new Delta().insert('Hello');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5, attributes: { bold: null } }]);
    });

    it('should detect attribute change', () => {
      const a = new Delta().insert('Hello', { color: 'red' });
      const b = new Delta().insert('Hello', { color: 'blue' });
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5, attributes: { color: 'blue' } }]);
    });

    it('should handle mixed text and attribute changes', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('Hello', { bold: true }).insert(' World');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5, attributes: { bold: true } }]);
    });
  });

  describe('embeds', () => {
    it('should detect embed insertion', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().insert('Hello').insert({ image: 'url' });
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5 }, { insert: { image: 'url' } }]);
    });

    it('should detect embed deletion', () => {
      const a = new Delta().insert('Hello').insert({ image: 'url' });
      const b = new Delta().insert('Hello');
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 5 }, { delete: 1 }]);
    });

    it('should detect embed attribute change', () => {
      const a = new Delta().insert({ image: 'url' });
      const b = new Delta().insert({ image: 'url' }, { alt: 'description' });
      const result = diff(a, b);

      expect(result.ops).toEqual([{ retain: 1, attributes: { alt: 'description' } }]);
    });
  });

  describe('compose property', () => {
    it('should satisfy compose(a, diff(a, b)) === b', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('Hello Earth!');
      const change = diff(a, b);

      const composed = a.compose(change);

      // Compare by converting to JSON since ops structure may differ
      expect(JSON.stringify(composed.ops)).toEqual(JSON.stringify(b.ops));
    });

    it('should work with attributes', () => {
      const a = new Delta().insert('Hello', { bold: true }).insert(' World');
      const b = new Delta().insert('Hello').insert(' World', { italic: true });
      const change = diff(a, b);

      const composed = a.compose(change);

      expect(JSON.stringify(composed.ops)).toEqual(JSON.stringify(b.ops));
    });
  });

  describe('Delta.diff method', () => {
    it('should work as instance method', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().insert('Hello World');
      const result = a.diff(b);

      expect(result.ops).toEqual([{ retain: 5 }, { insert: ' World' }]);
    });
  });

  describe('cursor hint', () => {
    it('should accept cursor position hint', () => {
      const a = new Delta().insert('ab');
      const b = new Delta().insert('abc');
      const result = diff(a, b, 2);

      // With cursor at position 2, insert should be at end
      expect(result.ops).toEqual([{ retain: 2 }, { insert: 'c' }]);
    });
  });
});
