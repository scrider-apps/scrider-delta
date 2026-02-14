import { describe, expect, it } from 'vitest';
import { Delta } from '../../src/delta/Delta';
import { compose } from '../../src/transform/compose';
import { diff } from '../../src/transform/diff';
import { invert } from '../../src/transform/invert';
import { transform } from '../../src/transform/transform';

/**
 * OT Property Tests
 *
 * These tests verify the fundamental mathematical properties that
 * Operational Transform algorithms must satisfy for correctness.
 */

describe('OT Properties', () => {
  describe('Compose Associativity', () => {
    /**
     * compose(compose(a, b), c) === compose(a, compose(b, c))
     *
     * The order of composition grouping should not matter.
     */

    it('should be associative for simple operations', () => {
      const a = new Delta().insert('A');
      const b = new Delta().retain(1).insert('B');
      const c = new Delta().retain(2).insert('C');

      const left = compose(compose(a, b), c);
      const right = compose(a, compose(b, c));

      expect(JSON.stringify(left.ops)).toEqual(JSON.stringify(right.ops));
    });

    it('should be associative with deletes', () => {
      // Operations that could be applied to a document like "Hello World"
      const a = new Delta().retain(5).insert('!');
      const b = new Delta().retain(6).delete(1);
      const c = new Delta().retain(5).insert('-');

      const left = compose(compose(a, b), c);
      const right = compose(a, compose(b, c));

      expect(JSON.stringify(left.ops)).toEqual(JSON.stringify(right.ops));
    });

    it('should be associative with attributes', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().retain(5, { bold: true });
      const c = new Delta().retain(5, { italic: true });

      const left = compose(compose(a, b), c);
      const right = compose(a, compose(b, c));

      expect(JSON.stringify(left.ops)).toEqual(JSON.stringify(right.ops));
    });

    it('should be associative for complex operations', () => {
      const a = new Delta().insert('Hello').delete(3);
      const b = new Delta().retain(2).insert(' World').delete(1);
      const c = new Delta().retain(5, { bold: true }).insert('!');

      const left = compose(compose(a, b), c);
      const right = compose(a, compose(b, c));

      expect(JSON.stringify(left.ops)).toEqual(JSON.stringify(right.ops));
    });
  });

  describe('Transform Convergence (TP1)', () => {
    /**
     * compose(a, transform(a, b, true)) === compose(b, transform(b, a, false))
     *
     * This is the fundamental OT property (TP1) that ensures
     * two clients applying operations in different orders converge
     * to the same document state.
     */

    it('should converge for insert vs insert', () => {
      const a = new Delta().insert('A');
      const b = new Delta().insert('B');

      const aPrime = transform(b, a, false);
      const bPrime = transform(a, b, true);

      const resultA = compose(a, bPrime);
      const resultB = compose(b, aPrime);

      expect(JSON.stringify(resultA.ops)).toEqual(JSON.stringify(resultB.ops));
    });

    it('should converge for insert vs delete', () => {
      // Base document: "Hello"
      const a = new Delta().retain(2).insert('XX'); // "HeXXllo"
      const b = new Delta().retain(3).delete(2); // "Hel"

      const aPrime = transform(b, a, false);
      const bPrime = transform(a, b, true);

      const resultA = compose(a, bPrime);
      const resultB = compose(b, aPrime);

      expect(JSON.stringify(resultA.ops)).toEqual(JSON.stringify(resultB.ops));
    });

    it('should converge for insert vs retain with attributes', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().retain(5, { bold: true });

      const aPrime = transform(b, a, false);
      const bPrime = transform(a, b, true);

      const resultA = compose(a, bPrime);
      const resultB = compose(b, aPrime);

      expect(JSON.stringify(resultA.ops)).toEqual(JSON.stringify(resultB.ops));
    });

    it('should converge for delete vs delete', () => {
      // Both delete different parts
      const a = new Delta().delete(3);
      const b = new Delta().retain(3).delete(3);

      const aPrime = transform(b, a, false);
      const bPrime = transform(a, b, true);

      const resultA = compose(a, bPrime);
      const resultB = compose(b, aPrime);

      expect(JSON.stringify(resultA.ops)).toEqual(JSON.stringify(resultB.ops));
    });

    it('should converge for overlapping deletes', () => {
      // Both try to delete the same content
      const a = new Delta().delete(5);
      const b = new Delta().delete(5);

      const aPrime = transform(b, a, false);
      const bPrime = transform(a, b, true);

      const resultA = compose(a, bPrime);
      const resultB = compose(b, aPrime);

      expect(JSON.stringify(resultA.ops)).toEqual(JSON.stringify(resultB.ops));
    });

    it('should converge for complex concurrent edits', () => {
      // Simulate two users editing "Hello World"
      // User A: inserts "!" after "Hello"
      // User B: makes "World" bold
      const a = new Delta().retain(5).insert('!');
      const b = new Delta().retain(6).retain(5, { bold: true });

      const aPrime = transform(b, a, false);
      const bPrime = transform(a, b, true);

      const resultA = compose(a, bPrime);
      const resultB = compose(b, aPrime);

      expect(JSON.stringify(resultA.ops)).toEqual(JSON.stringify(resultB.ops));
    });

    it('should converge for attribute conflicts', () => {
      // Both try to change the same attribute
      const a = new Delta().retain(5, { color: 'red' });
      const b = new Delta().retain(5, { color: 'blue' });

      const aPrime = transform(b, a, false);
      const bPrime = transform(a, b, true);

      const resultA = compose(a, bPrime);
      const resultB = compose(b, aPrime);

      expect(JSON.stringify(resultA.ops)).toEqual(JSON.stringify(resultB.ops));
    });
  });

  describe('Invert Property', () => {
    /**
     * compose(compose(base, change), invert(change, base)) === base
     *
     * Applying a change and then its inverse should return to the original.
     */

    it('should invert inserts', () => {
      const base = new Delta().insert('Hello');
      const change = new Delta().retain(5).insert(' World');

      const applied = compose(base, change);
      const inverse = invert(change, base);
      const undone = compose(applied, inverse);

      expect(JSON.stringify(undone.ops)).toEqual(JSON.stringify(base.ops));
    });

    it('should invert deletes', () => {
      const base = new Delta().insert('Hello World');
      const change = new Delta().retain(5).delete(6);

      const applied = compose(base, change);
      const inverse = invert(change, base);
      const undone = compose(applied, inverse);

      expect(JSON.stringify(undone.ops)).toEqual(JSON.stringify(base.ops));
    });

    it('should invert attribute changes', () => {
      const base = new Delta().insert('Hello', { bold: true });
      const change = new Delta().retain(5, { bold: null, italic: true });

      const applied = compose(base, change);
      const inverse = invert(change, base);
      const undone = compose(applied, inverse);

      expect(JSON.stringify(undone.ops)).toEqual(JSON.stringify(base.ops));
    });

    it('should invert complex changes', () => {
      const base = new Delta()
        .insert('Hello', { bold: true })
        .insert(' ')
        .insert('World', { italic: true });

      const change = new Delta()
        .delete(5)
        .insert('Goodbye')
        .retain(1)
        .retain(5, { italic: null, underline: true })
        .insert('!');

      const applied = compose(base, change);
      const inverse = invert(change, base);
      const undone = compose(applied, inverse);

      expect(JSON.stringify(undone.ops)).toEqual(JSON.stringify(base.ops));
    });
  });

  describe('Diff Property', () => {
    /**
     * compose(a, diff(a, b)) === b
     *
     * The diff between two documents, when applied to the first,
     * should produce the second.
     */

    it('should work for simple text changes', () => {
      const a = new Delta().insert('Hello');
      const b = new Delta().insert('Hello World');

      const change = diff(a, b);
      const result = compose(a, change);

      expect(JSON.stringify(result.ops)).toEqual(JSON.stringify(b.ops));
    });

    it('should work for deletions', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('Hello');

      const change = diff(a, b);
      const result = compose(a, change);

      expect(JSON.stringify(result.ops)).toEqual(JSON.stringify(b.ops));
    });

    it('should work for replacements', () => {
      const a = new Delta().insert('Hello World');
      const b = new Delta().insert('Goodbye Earth');

      const change = diff(a, b);
      const result = compose(a, change);

      expect(JSON.stringify(result.ops)).toEqual(JSON.stringify(b.ops));
    });

    it('should work for attribute changes', () => {
      const a = new Delta().insert('Hello', { bold: true });
      const b = new Delta().insert('Hello', { italic: true });

      const change = diff(a, b);
      const result = compose(a, change);

      expect(JSON.stringify(result.ops)).toEqual(JSON.stringify(b.ops));
    });

    it('should work for complex documents', () => {
      const a = new Delta()
        .insert('Hello', { bold: true })
        .insert(' World')
        .insert({ image: 'old.png' });

      const b = new Delta()
        .insert('Hi', { italic: true })
        .insert(' Earth!')
        .insert({ image: 'new.png' });

      const change = diff(a, b);
      const result = compose(a, change);

      expect(JSON.stringify(result.ops)).toEqual(JSON.stringify(b.ops));
    });
  });

  describe('Combined Properties', () => {
    /**
     * Test multiple properties together for comprehensive verification
     */

    it('should support collaborative editing scenario', () => {
      // Initial document
      const doc = new Delta().insert('Hello World\n');

      // User A: makes "Hello" bold
      const changeA = new Delta().retain(5, { bold: true });

      // User B: inserts "!" before newline
      const changeB = new Delta().retain(11).insert('!');

      // Transform to get concurrent operations
      const changeAPrime = transform(changeB, changeA, false);
      const changeBPrime = transform(changeA, changeB, true);

      // Apply in both orders
      const resultViaA = compose(compose(doc, changeA), changeBPrime);
      const resultViaB = compose(compose(doc, changeB), changeAPrime);

      // Should converge
      expect(JSON.stringify(resultViaA.ops)).toEqual(JSON.stringify(resultViaB.ops));

      // Verify we can undo
      const inverseA = invert(changeA, doc);
      const inverseB = invert(changeBPrime, compose(doc, changeA));

      const afterUndoB = compose(resultViaA, inverseB);
      const afterUndoAll = compose(afterUndoB, inverseA);

      expect(JSON.stringify(afterUndoAll.ops)).toEqual(JSON.stringify(doc.ops));
    });

    it('should handle undo/redo cycle', () => {
      const doc = new Delta().insert('Hello World');

      // Make a change
      const change1 = new Delta().retain(5).insert('!');
      const doc1 = compose(doc, change1);

      // Make another change
      const change2 = new Delta().retain(6).delete(6);
      const doc2 = compose(doc1, change2);

      // Undo change2
      const inverse2 = invert(change2, doc1);
      const doc1Again = compose(doc2, inverse2);
      expect(JSON.stringify(doc1Again.ops)).toEqual(JSON.stringify(doc1.ops));

      // Redo change2
      const doc2Again = compose(doc1Again, change2);
      expect(JSON.stringify(doc2Again.ops)).toEqual(JSON.stringify(doc2.ops));

      // Undo both
      const undone2 = compose(doc2, inverse2);
      const inverse1 = invert(change1, doc);
      const undoneAll = compose(undone2, inverse1);
      expect(JSON.stringify(undoneAll.ops)).toEqual(JSON.stringify(doc.ops));
    });
  });
});
