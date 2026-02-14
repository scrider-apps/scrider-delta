import { describe, expect, it } from 'vitest';
import { Delta } from '../../src/delta/Delta';
import type { AttributeMap, Op } from '../../src/delta/Op';
import { isInsert } from '../../src/delta/Op';

/**
 * Helper to extract insert text from ops for testing
 */
function getInsertText(op: Op): string {
  if (isInsert(op) && typeof op.insert === 'string') {
    return op.insert;
  }
  return '';
}

/**
 * Helper to check if op has attributes
 */
function hasAttributes(op: Op): boolean {
  return isInsert(op) && op.attributes !== undefined;
}

describe('Delta', () => {
  describe('constructor', () => {
    it('creates empty Delta by default', () => {
      const delta = new Delta();
      expect(delta.ops).toEqual([]);
    });

    it('creates Delta from ops array', () => {
      const ops: Op[] = [{ insert: 'hello' }];
      const delta = new Delta(ops);
      expect(delta.ops).toEqual(ops);
    });

    it('creates Delta from another Delta', () => {
      const original = new Delta([{ insert: 'hello' }]);
      const copy = new Delta(original);
      expect(copy.ops).toEqual(original.ops);
      expect(copy.ops).not.toBe(original.ops);
    });

    it('creates Delta from object with ops', () => {
      const delta = new Delta({ ops: [{ insert: 'hello' }] });
      expect(delta.ops).toEqual([{ insert: 'hello' }]);
    });
  });

  describe('insert', () => {
    it('adds text insert', () => {
      const delta = new Delta().insert('hello');
      expect(delta.ops).toEqual([{ insert: 'hello' }]);
    });

    it('adds text insert with attributes', () => {
      const delta = new Delta().insert('hello', { bold: true });
      expect(delta.ops).toEqual([{ insert: 'hello', attributes: { bold: true } }]);
    });

    it('adds embed insert', () => {
      const delta = new Delta().insert({ image: 'url' });
      expect(delta.ops).toEqual([{ insert: { image: 'url' } }]);
    });

    it('adds embed insert with attributes', () => {
      const delta = new Delta().insert({ image: 'url' }, { width: 100 });
      expect(delta.ops).toEqual([{ insert: { image: 'url' }, attributes: { width: 100 } }]);
    });

    it('ignores empty string', () => {
      const delta = new Delta().insert('');
      expect(delta.ops).toEqual([]);
    });

    it('ignores empty attributes', () => {
      const delta = new Delta().insert('hello', {});
      expect(delta.ops).toEqual([{ insert: 'hello' }]);
    });

    it('throws for invalid insert value', () => {
      const delta = new Delta();

      expect(() => delta.insert(null as unknown as string)).toThrow();

      expect(() => delta.insert(123 as unknown as string)).toThrow();
    });

    it('returns this for chaining', () => {
      const delta = new Delta();
      expect(delta.insert('hello')).toBe(delta);
    });
  });

  describe('delete', () => {
    it('adds delete operation', () => {
      const delta = new Delta().delete(5);
      expect(delta.ops).toEqual([{ delete: 5 }]);
    });

    it('ignores zero delete', () => {
      const delta = new Delta().delete(0);
      expect(delta.ops).toEqual([]);
    });

    it('throws for negative delete', () => {
      const delta = new Delta();
      expect(() => delta.delete(-5)).toThrow();
    });

    it('throws for non-integer delete', () => {
      const delta = new Delta();
      expect(() => delta.delete(5.5)).toThrow();
    });

    it('returns this for chaining', () => {
      const delta = new Delta();
      expect(delta.delete(5)).toBe(delta);
    });
  });

  describe('retain', () => {
    it('adds retain operation', () => {
      const delta = new Delta().retain(5);
      expect(delta.ops).toEqual([{ retain: 5 }]);
    });

    it('adds retain with attributes', () => {
      const delta = new Delta().retain(5, { bold: true });
      expect(delta.ops).toEqual([{ retain: 5, attributes: { bold: true } }]);
    });

    it('ignores zero retain', () => {
      const delta = new Delta().retain(0);
      expect(delta.ops).toEqual([]);
    });

    it('ignores empty attributes', () => {
      const delta = new Delta().retain(5, {});
      expect(delta.ops).toEqual([{ retain: 5 }]);
    });

    it('throws for negative retain', () => {
      const delta = new Delta();
      expect(() => delta.retain(-5)).toThrow();
    });

    it('throws for non-integer retain', () => {
      const delta = new Delta();
      expect(() => delta.retain(5.5)).toThrow();
    });

    it('returns this for chaining', () => {
      const delta = new Delta();
      expect(delta.retain(5)).toBe(delta);
    });
  });

  describe('push (compaction)', () => {
    it('merges adjacent text inserts with same attributes', () => {
      const delta = new Delta().insert('hello').insert(' world');
      expect(delta.ops).toEqual([{ insert: 'hello world' }]);
    });

    it('merges adjacent text inserts with equal attributes', () => {
      const delta = new Delta().insert('hello', { bold: true }).insert(' world', { bold: true });
      expect(delta.ops).toEqual([{ insert: 'hello world', attributes: { bold: true } }]);
    });

    it('does not merge text inserts with different attributes', () => {
      const delta = new Delta().insert('hello', { bold: true }).insert(' world');
      expect(delta.ops).toEqual([
        { insert: 'hello', attributes: { bold: true } },
        { insert: ' world' },
      ]);
    });

    it('merges adjacent retains without attributes', () => {
      const delta = new Delta().retain(5).retain(3);
      expect(delta.ops).toEqual([{ retain: 8 }]);
    });

    it('merges adjacent retains with same attributes', () => {
      const delta = new Delta().retain(5, { bold: true }).retain(3, { bold: true });
      expect(delta.ops).toEqual([{ retain: 8, attributes: { bold: true } }]);
    });

    it('does not merge retains with different attributes', () => {
      const delta = new Delta().retain(5, { bold: true }).retain(3, { italic: true });
      expect(delta.ops).toEqual([
        { retain: 5, attributes: { bold: true } },
        { retain: 3, attributes: { italic: true } },
      ]);
    });

    it('merges adjacent deletes', () => {
      const delta = new Delta().delete(5).delete(3);
      expect(delta.ops).toEqual([{ delete: 8 }]);
    });

    it('puts insert before delete for normalization', () => {
      const delta = new Delta().delete(5).insert('hello');
      expect(delta.ops).toEqual([{ insert: 'hello' }, { delete: 5 }]);
    });

    it('does not merge embed inserts', () => {
      const delta = new Delta().insert({ image: 'a' }).insert({ image: 'b' });
      expect(delta.ops).toEqual([{ insert: { image: 'a' } }, { insert: { image: 'b' } }]);
    });
  });

  describe('length', () => {
    it('returns 0 for empty delta', () => {
      expect(new Delta().length()).toBe(0);
    });

    it('returns text length', () => {
      expect(new Delta().insert('hello').length()).toBe(5);
    });

    it('returns 1 for embed', () => {
      expect(new Delta().insert({ image: 'url' }).length()).toBe(1);
    });

    it('ignores retains and deletes', () => {
      expect(new Delta().insert('hello').retain(5).delete(3).length()).toBe(5);
    });
  });

  describe('changeLength', () => {
    it('returns 0 for empty delta', () => {
      expect(new Delta().changeLength()).toBe(0);
    });

    it('returns positive for inserts', () => {
      expect(new Delta().insert('hello').changeLength()).toBe(5);
    });

    it('returns negative for deletes', () => {
      expect(new Delta().delete(3).changeLength()).toBe(-3);
    });

    it('combines inserts and deletes', () => {
      expect(new Delta().insert('hello').delete(3).changeLength()).toBe(2);
    });

    it('ignores retains', () => {
      expect(new Delta().insert('hello').retain(5).changeLength()).toBe(5);
    });
  });

  describe('slice', () => {
    it('returns empty for empty delta', () => {
      expect(new Delta().slice().ops).toEqual([]);
    });

    it('returns full delta by default', () => {
      const delta = new Delta().insert('hello');
      expect(delta.slice().ops).toEqual([{ insert: 'hello' }]);
    });

    it('slices from start', () => {
      const delta = new Delta().insert('hello');
      expect(delta.slice(2).ops).toEqual([{ insert: 'llo' }]);
    });

    it('slices to end', () => {
      const delta = new Delta().insert('hello');
      expect(delta.slice(0, 2).ops).toEqual([{ insert: 'he' }]);
    });

    it('slices middle', () => {
      const delta = new Delta().insert('hello');
      expect(delta.slice(1, 4).ops).toEqual([{ insert: 'ell' }]);
    });

    it('preserves attributes', () => {
      const delta = new Delta().insert('hello', { bold: true });
      expect(delta.slice(1, 4).ops).toEqual([{ insert: 'ell', attributes: { bold: true } }]);
    });

    it('handles multiple ops', () => {
      const delta = new Delta().insert('hello', { bold: true }).insert(' world');
      expect(delta.slice(3, 8).ops).toEqual([
        { insert: 'lo', attributes: { bold: true } },
        { insert: ' wo' },
      ]);
    });
  });

  describe('concat', () => {
    it('returns copy for empty other', () => {
      const delta = new Delta().insert('hello');
      const result = delta.concat(new Delta());
      expect(result.ops).toEqual([{ insert: 'hello' }]);
      expect(result).not.toBe(delta);
    });

    it('concatenates deltas', () => {
      const a = new Delta().insert('hello');
      const b = new Delta().insert(' world');
      expect(a.concat(b).ops).toEqual([{ insert: 'hello world' }]);
    });

    it('merges compatible ops at boundary', () => {
      const a = new Delta().insert('hello', { bold: true });
      const b = new Delta().insert(' world', { bold: true });
      expect(a.concat(b).ops).toEqual([{ insert: 'hello world', attributes: { bold: true } }]);
    });

    it('does not merge incompatible ops', () => {
      const a = new Delta().insert('hello', { bold: true });
      const b = new Delta().insert(' world');
      expect(a.concat(b).ops).toEqual([
        { insert: 'hello', attributes: { bold: true } },
        { insert: ' world' },
      ]);
    });
  });

  describe('eachLine', () => {
    it('iterates over single line', () => {
      const delta = new Delta().insert('hello\n');
      const lines: string[] = [];
      delta.eachLine((line) => {
        lines.push(line.ops.map(getInsertText).join(''));
      });
      expect(lines).toEqual(['hello']);
    });

    it('iterates over multiple lines', () => {
      const delta = new Delta().insert('hello\nworld\n');
      const lines: string[] = [];
      delta.eachLine((line) => {
        lines.push(line.ops.map(getInsertText).join(''));
      });
      expect(lines).toEqual(['hello', 'world']);
    });

    it('provides line attributes', () => {
      const delta = new Delta().insert('hello').insert('\n', { header: 1 }).insert('world\n');
      const attrs: AttributeMap[] = [];
      delta.eachLine((_, attributes) => {
        attrs.push(attributes);
      });
      expect(attrs).toEqual([{ header: 1 }, {}]);
    });

    it('provides line index', () => {
      const delta = new Delta().insert('a\nb\nc\n');
      const indices: number[] = [];
      delta.eachLine((_, __, index) => {
        indices.push(index);
      });
      expect(indices).toEqual([0, 1, 2]);
    });

    it('stops iteration when callback returns false', () => {
      const delta = new Delta().insert('a\nb\nc\n');
      const lines: string[] = [];
      delta.eachLine((line) => {
        lines.push(line.ops.map(getInsertText).join(''));
        if (lines.length === 2) return false;
        return;
      });
      expect(lines).toEqual(['a', 'b']);
    });

    it('handles line without trailing newline', () => {
      const delta = new Delta().insert('hello');
      const lines: string[] = [];
      delta.eachLine((line) => {
        lines.push(line.ops.map(getInsertText).join(''));
      });
      expect(lines).toEqual(['hello']);
    });
  });

  describe('iteration methods', () => {
    // Note: ' ' and 'world' are compacted into ' world' because they have same attributes
    const delta = new Delta().insert('hello', { bold: true }).insert(' ').insert('world');

    it('filter returns matching ops', () => {
      const result = delta.filter(hasAttributes);
      expect(result).toEqual([{ insert: 'hello', attributes: { bold: true } }]);
    });

    it('forEach iterates all ops', () => {
      const inserts: string[] = [];
      delta.forEach((op) => inserts.push(getInsertText(op)));
      // ' ' and 'world' are compacted to ' world'
      expect(inserts).toEqual(['hello', ' world']);
    });

    it('map transforms ops', () => {
      const lengths = delta.map((op) => getInsertText(op).length);
      // 'hello' = 5, ' world' = 6
      expect(lengths).toEqual([5, 6]);
    });

    it('reduce accumulates', () => {
      const total = delta.reduce((acc, op) => acc + getInsertText(op).length, 0);
      expect(total).toBe(11);
    });

    it('partition splits ops', () => {
      const [withAttrs, withoutAttrs] = delta.partition(hasAttributes);
      expect(withAttrs.length).toBe(1);
      // Only 1 op without attrs due to compaction
      expect(withoutAttrs.length).toBe(1);
    });
  });

  describe('chop', () => {
    it('removes trailing retain without attributes', () => {
      const delta = new Delta().insert('hello').retain(5);
      delta.chop();
      expect(delta.ops).toEqual([{ insert: 'hello' }]);
    });

    it('keeps trailing retain with attributes', () => {
      const delta = new Delta().insert('hello').retain(5, { bold: true });
      delta.chop();
      expect(delta.ops).toEqual([{ insert: 'hello' }, { retain: 5, attributes: { bold: true } }]);
    });

    it('removes multiple trailing retains', () => {
      const delta = new Delta([{ insert: 'hello' }, { retain: 3 }, { retain: 5 }]);
      delta.chop();
      expect(delta.ops).toEqual([{ insert: 'hello' }]);
    });

    it('returns this for chaining', () => {
      const delta = new Delta().insert('hello').retain(5);
      expect(delta.chop()).toBe(delta);
    });
  });

  describe('chaining', () => {
    it('supports full chaining', () => {
      const delta = new Delta()
        .insert('Hello', { bold: true })
        .insert(' ')
        .insert('World')
        .insert('\n', { header: 1 });

      expect(delta.ops).toEqual([
        { insert: 'Hello', attributes: { bold: true } },
        { insert: ' World' },
        { insert: '\n', attributes: { header: 1 } },
      ]);
    });
  });
});
