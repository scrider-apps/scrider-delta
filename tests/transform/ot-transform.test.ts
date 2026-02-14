import { describe, expect, it } from 'vitest';
import { Delta } from '../../src/delta/Delta';
import { transform, transformPosition } from '../../src/transform/transform';

describe('transform', () => {
  describe('insert vs insert', () => {
    it('should handle concurrent inserts (priority=false)', () => {
      const a = new Delta().insert('A');
      const b = new Delta().insert('B');

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ retain: 1 }, { insert: 'B' }]);
    });

    it('should handle concurrent inserts (priority=true)', () => {
      const a = new Delta().insert('A');
      const b = new Delta().insert('B');

      // priority=true: b wins, b's insert comes first
      // trailing retain is chopped
      const result = transform(a, b, true);
      expect(result.ops).toEqual([{ insert: 'B' }]);
    });

    it('should handle inserts at different positions', () => {
      const a = new Delta().insert('A');
      const b = new Delta().retain(5).insert('B');

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ retain: 6 }, { insert: 'B' }]);
    });
  });

  describe('insert vs retain', () => {
    it('should transform retain to account for insert', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().retain(3, { bold: true });

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ retain: 5 }, { retain: 3, attributes: { bold: true } }]);
    });
  });

  describe('insert vs delete', () => {
    it('should transform delete to account for insert', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().delete(3);

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ retain: 5 }, { delete: 3 }]);
    });
  });

  describe('retain vs insert', () => {
    it('should keep insert unchanged', () => {
      const a = new Delta().retain(5);
      const b = new Delta().insert('Hello');

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ insert: 'Hello' }]);
    });
  });

  describe('retain vs retain', () => {
    it('should handle non-conflicting attributes', () => {
      const a = new Delta().retain(5, { bold: true });
      const b = new Delta().retain(5, { italic: true });

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ retain: 5, attributes: { italic: true } }]);
    });

    it('should handle conflicting attributes (priority=false)', () => {
      const a = new Delta().retain(5, { color: 'red' });
      const b = new Delta().retain(5, { color: 'blue' });

      // priority=false: a wins, b's color dropped, plain retain is chopped
      const result = transform(a, b, false);
      expect(result.ops).toEqual([]);
    });

    it('should handle conflicting attributes (priority=true)', () => {
      const a = new Delta().retain(5, { color: 'red' });
      const b = new Delta().retain(5, { color: 'blue' });

      const result = transform(a, b, true);
      expect(result.ops).toEqual([{ retain: 5, attributes: { color: 'blue' } }]);
    });
  });

  describe('retain vs delete', () => {
    it('should keep delete unchanged', () => {
      const a = new Delta().retain(5);
      const b = new Delta().delete(3);

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ delete: 3 }]);
    });
  });

  describe('delete vs insert', () => {
    it('should keep insert unchanged when a deletes', () => {
      const a = new Delta().delete(5);
      const b = new Delta().insert('Hello');

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ insert: 'Hello' }]);
    });
  });

  describe('delete vs retain', () => {
    it('should skip retain over deleted content', () => {
      const a = new Delta().delete(5);
      const b = new Delta().retain(5, { bold: true });

      const result = transform(a, b, false);
      expect(result.ops).toEqual([]);
    });

    it('should handle partial delete', () => {
      const a = new Delta().delete(3);
      const b = new Delta().retain(5, { bold: true });

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ retain: 2, attributes: { bold: true } }]);
    });
  });

  describe('delete vs delete', () => {
    it('should skip delete over already deleted content', () => {
      const a = new Delta().delete(5);
      const b = new Delta().delete(5);

      const result = transform(a, b, false);
      expect(result.ops).toEqual([]);
    });

    it('should handle overlapping deletes', () => {
      const a = new Delta().delete(3);
      const b = new Delta().delete(5);

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ delete: 2 }]);
    });
  });

  describe('empty deltas', () => {
    it('should handle empty a', () => {
      const a = new Delta();
      const b = new Delta().insert('Hello');

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ insert: 'Hello' }]);
    });

    it('should handle empty b', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta();

      const result = transform(a, b, false);
      expect(result.ops).toEqual([]);
    });

    it('should handle both empty', () => {
      const a = new Delta();
      const b = new Delta();

      const result = transform(a, b, false);
      expect(result.ops).toEqual([]);
    });
  });

  describe('embeds', () => {
    it('should handle embed insert (priority=false)', () => {
      const a = new Delta().insert({ image: 'a.png' });
      const b = new Delta().insert({ image: 'b.png' });

      const result = transform(a, b, false);
      expect(result.ops).toEqual([{ retain: 1 }, { insert: { image: 'b.png' } }]);
    });

    it('should handle embed insert (priority=true)', () => {
      const a = new Delta().insert({ image: 'a.png' });
      const b = new Delta().insert({ image: 'b.png' });

      const result = transform(a, b, true);
      expect(result.ops).toEqual([{ insert: { image: 'b.png' } }]);
    });
  });
});

describe('transformPosition', () => {
  it('should shift position after insert at start', () => {
    const delta = new Delta().insert('Hello');
    expect(transformPosition(delta, 0, false)).toBe(5);
  });

  it('should shift position for insert before cursor', () => {
    const delta = new Delta().insert('XX');
    expect(transformPosition(delta, 5, false)).toBe(7);
  });

  it('should handle insert at cursor with priority=true', () => {
    const delta = new Delta().insert('Hello');
    expect(transformPosition(delta, 0, true)).toBe(0);
  });

  it('should shift position back for delete before cursor', () => {
    const delta = new Delta().delete(3);
    expect(transformPosition(delta, 5, false)).toBe(2);
  });

  it('should handle delete crossing cursor position', () => {
    const delta = new Delta().delete(10);
    expect(transformPosition(delta, 5, false)).toBe(0);
  });

  it('should not change position for plain retain', () => {
    const delta = new Delta().retain(10);
    expect(transformPosition(delta, 5, false)).toBe(5);
  });

  it('should return original position for empty delta', () => {
    const delta = new Delta();
    expect(transformPosition(delta, 5, false)).toBe(5);
  });

  it('should treat embed as length 1', () => {
    const delta = new Delta().insert({ image: 'pic.png' });
    expect(transformPosition(delta, 0, false)).toBe(1);
  });

  it('should handle embed with priority=true', () => {
    const delta = new Delta().insert({ image: 'pic.png' });
    expect(transformPosition(delta, 0, true)).toBe(0);
  });

  it('should handle delete starting at cursor', () => {
    const delta = new Delta().retain(5).delete(3);
    expect(transformPosition(delta, 5, false)).toBe(5);
  });

  it('should not affect position for insert after cursor', () => {
    const delta = new Delta().retain(10).insert('XX');
    expect(transformPosition(delta, 5, false)).toBe(5);
  });

  it('should not affect position for delete after cursor', () => {
    const delta = new Delta().retain(10).delete(5);
    expect(transformPosition(delta, 5, false)).toBe(5);
  });

  it('should handle multiple operations', () => {
    const delta = new Delta().insert('XX').retain(3).delete(2);
    // cursor at 10: +2 (insert) = 12, then -2 (delete at pos 5) if cursor > 5
    expect(transformPosition(delta, 10, false)).toBe(10);
  });
});
