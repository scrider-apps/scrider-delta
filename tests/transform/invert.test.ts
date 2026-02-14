import { describe, expect, it } from 'vitest';
import { Delta } from '../../src/delta/Delta';
import { invert } from '../../src/transform/invert';

describe('invert', () => {
  describe('insert operations', () => {
    it('should invert insert to delete', () => {
      const base = new Delta().insert('Hello');
      const change = new Delta().retain(5).insert(' World');
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ retain: 5 }, { delete: 6 }]);
    });

    it('should invert insert at beginning', () => {
      const base = new Delta().insert('World');
      const change = new Delta().insert('Hello ');
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ delete: 6 }]);
    });
  });

  describe('delete operations', () => {
    it('should invert delete to insert', () => {
      const base = new Delta().insert('Hello World');
      const change = new Delta().retain(5).delete(6);
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ retain: 5 }, { insert: ' World' }]);
    });

    it('should invert delete at beginning', () => {
      const base = new Delta().insert('Hello World');
      const change = new Delta().delete(6);
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ insert: 'Hello ' }]);
    });

    it('should invert delete with attributes', () => {
      const base = new Delta().insert('Hello', { bold: true }).insert(' World');
      const change = new Delta().delete(5);
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ insert: 'Hello', attributes: { bold: true } }]);
    });
  });

  describe('retain operations', () => {
    it('should invert retain without attributes', () => {
      const base = new Delta().insert('Hello');
      const change = new Delta().retain(5);
      const inverse = invert(change, base);

      // Plain retain has no effect
      expect(inverse.ops).toEqual([]);
    });

    it('should invert retain with attribute addition', () => {
      const base = new Delta().insert('Hello');
      const change = new Delta().retain(5, { bold: true });
      const inverse = invert(change, base);

      // Should remove the added attribute
      expect(inverse.ops).toEqual([{ retain: 5, attributes: { bold: null } }]);
    });

    it('should invert retain with attribute removal', () => {
      const base = new Delta().insert('Hello', { bold: true });
      const change = new Delta().retain(5, { bold: null });
      const inverse = invert(change, base);

      // Should restore the removed attribute
      expect(inverse.ops).toEqual([{ retain: 5, attributes: { bold: true } }]);
    });

    it('should invert retain with attribute change', () => {
      const base = new Delta().insert('Hello', { color: 'red' });
      const change = new Delta().retain(5, { color: 'blue' });
      const inverse = invert(change, base);

      // Should restore original color
      expect(inverse.ops).toEqual([{ retain: 5, attributes: { color: 'red' } }]);
    });
  });

  describe('complex operations', () => {
    it('should invert mixed operations', () => {
      const base = new Delta().insert('Hello World');
      const change = new Delta().retain(5).delete(1).insert('-');
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ retain: 5 }, { insert: ' ' }, { delete: 1 }]);
    });

    it('should invert multiple changes', () => {
      const base = new Delta().insert('Hello World');
      const change = new Delta().retain(6, { bold: true }).retain(5, { italic: true });
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([
        { retain: 6, attributes: { bold: null } },
        { retain: 5, attributes: { italic: null } },
      ]);
    });
  });

  describe('embeds', () => {
    it('should invert embed insertion', () => {
      const base = new Delta().insert('Hello');
      const change = new Delta().retain(5).insert({ image: 'url' });
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ retain: 5 }, { delete: 1 }]);
    });

    it('should invert embed deletion', () => {
      const base = new Delta().insert('Hello').insert({ image: 'url' }).insert('World');
      const change = new Delta().retain(5).delete(1);
      const inverse = invert(change, base);

      expect(inverse.ops).toEqual([{ retain: 5 }, { insert: { image: 'url' } }]);
    });
  });

  describe('undo property', () => {
    it('should satisfy compose(compose(base, change), invert(change, base)) === base', () => {
      const base = new Delta().insert('Hello World');
      const change = new Delta().retain(5).delete(1).insert('-').retain(5, { bold: true });

      const applied = base.compose(change);
      const inverse = invert(change, base);
      const undone = applied.compose(inverse);

      expect(JSON.stringify(undone.ops)).toEqual(JSON.stringify(base.ops));
    });

    it('should undo attribute changes', () => {
      const base = new Delta().insert('Hello', { bold: true }).insert(' World');
      const change = new Delta()
        .retain(5, { bold: null, italic: true })
        .retain(6, { underline: true });

      const applied = base.compose(change);
      const inverse = invert(change, base);
      const undone = applied.compose(inverse);

      expect(JSON.stringify(undone.ops)).toEqual(JSON.stringify(base.ops));
    });

    it('should undo insertions and deletions', () => {
      const base = new Delta().insert('Hello World');
      const change = new Delta().delete(6).insert('Goodbye ').retain(5).insert('!');

      const applied = base.compose(change);
      const inverse = invert(change, base);
      const undone = applied.compose(inverse);

      expect(JSON.stringify(undone.ops)).toEqual(JSON.stringify(base.ops));
    });
  });

  describe('Delta.invert method', () => {
    it('should work as instance method', () => {
      const base = new Delta().insert('Hello');
      const change = new Delta().retain(5).insert(' World');
      const inverse = change.invert(base);

      expect(inverse.ops).toEqual([{ retain: 5 }, { delete: 6 }]);
    });
  });
});
