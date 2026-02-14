import { describe, expect, it } from 'vitest';
import { OpIterator } from '../../src/delta/Iterator';
import type { Op } from '../../src/delta/Op';

describe('OpIterator', () => {
  describe('hasNext', () => {
    it('returns false for empty ops', () => {
      const iter = new OpIterator([]);
      expect(iter.hasNext()).toBe(false);
    });

    it('returns true when ops exist', () => {
      const iter = new OpIterator([{ insert: 'hello' }]);
      expect(iter.hasNext()).toBe(true);
    });

    it('returns false after consuming all ops', () => {
      const iter = new OpIterator([{ insert: 'hi' }]);
      iter.next();
      expect(iter.hasNext()).toBe(false);
    });
  });

  describe('next', () => {
    it('returns entire insert op by default', () => {
      const iter = new OpIterator([{ insert: 'hello' }]);
      expect(iter.next()).toEqual({ insert: 'hello' });
    });

    it('returns partial text insert', () => {
      const iter = new OpIterator([{ insert: 'hello' }]);
      expect(iter.next(2)).toEqual({ insert: 'he' });
      expect(iter.next(3)).toEqual({ insert: 'llo' });
    });

    it('preserves attributes on partial insert', () => {
      const iter = new OpIterator([{ insert: 'hello', attributes: { bold: true } }]);
      expect(iter.next(2)).toEqual({ insert: 'he', attributes: { bold: true } });
      expect(iter.next(3)).toEqual({ insert: 'llo', attributes: { bold: true } });
    });

    it('returns entire retain op by default', () => {
      const iter = new OpIterator([{ retain: 5 }]);
      expect(iter.next()).toEqual({ retain: 5 });
    });

    it('returns partial retain', () => {
      const iter = new OpIterator([{ retain: 5 }]);
      expect(iter.next(2)).toEqual({ retain: 2 });
      expect(iter.next(3)).toEqual({ retain: 3 });
    });

    it('preserves attributes on partial retain', () => {
      const iter = new OpIterator([{ retain: 5, attributes: { bold: true } }]);
      expect(iter.next(2)).toEqual({ retain: 2, attributes: { bold: true } });
    });

    it('returns entire delete op by default', () => {
      const iter = new OpIterator([{ delete: 3 }]);
      expect(iter.next()).toEqual({ delete: 3 });
    });

    it('returns partial delete', () => {
      const iter = new OpIterator([{ delete: 5 }]);
      expect(iter.next(2)).toEqual({ delete: 2 });
      expect(iter.next(3)).toEqual({ delete: 3 });
    });

    it('returns embed insert atomically', () => {
      const iter = new OpIterator([{ insert: { image: 'url' } }]);
      expect(iter.next()).toEqual({ insert: { image: 'url' } });
    });

    it('returns embed insert with attributes', () => {
      const iter = new OpIterator([{ insert: { image: 'url' }, attributes: { width: 100 } }]);
      expect(iter.next()).toEqual({
        insert: { image: 'url' },
        attributes: { width: 100 },
      });
    });

    it('returns { retain: Infinity } when exhausted', () => {
      const iter = new OpIterator([{ insert: 'hi' }]);
      iter.next();
      expect(iter.next()).toEqual({ retain: Infinity });
    });

    it('iterates through multiple ops', () => {
      const iter = new OpIterator([{ insert: 'ab' }, { retain: 3 }, { delete: 2 }]);
      expect(iter.next()).toEqual({ insert: 'ab' });
      expect(iter.next()).toEqual({ retain: 3 });
      expect(iter.next()).toEqual({ delete: 2 });
      expect(iter.hasNext()).toBe(false);
    });

    it('handles mixed partial and full consumption', () => {
      const iter = new OpIterator([{ insert: 'hello' }, { retain: 3 }]);
      expect(iter.next(2)).toEqual({ insert: 'he' });
      expect(iter.next(10)).toEqual({ insert: 'llo' }); // consumes rest of insert
      expect(iter.next(1)).toEqual({ retain: 1 });
      expect(iter.next()).toEqual({ retain: 2 });
    });
  });

  describe('peek', () => {
    it('returns current op without advancing', () => {
      const iter = new OpIterator([{ insert: 'hello' }]);
      expect(iter.peek()).toEqual({ insert: 'hello' });
      expect(iter.peek()).toEqual({ insert: 'hello' }); // still same
      iter.next();
      expect(iter.peek()).toEqual({ retain: Infinity });
    });

    it('returns { retain: Infinity } for empty ops', () => {
      const iter = new OpIterator([]);
      expect(iter.peek()).toEqual({ retain: Infinity });
    });
  });

  describe('peekLength', () => {
    it('returns full length initially', () => {
      const iter = new OpIterator([{ insert: 'hello' }]);
      expect(iter.peekLength()).toBe(5);
    });

    it('returns remaining length after partial consume', () => {
      const iter = new OpIterator([{ insert: 'hello' }]);
      iter.next(2);
      expect(iter.peekLength()).toBe(3);
    });

    it('returns Infinity when exhausted', () => {
      const iter = new OpIterator([{ insert: 'hi' }]);
      iter.next();
      expect(iter.peekLength()).toBe(Infinity);
    });

    it('returns 1 for embed', () => {
      const iter = new OpIterator([{ insert: { image: 'url' } }]);
      expect(iter.peekLength()).toBe(1);
    });
  });

  describe('peekType', () => {
    it('returns "insert" for insert ops', () => {
      const iter = new OpIterator([{ insert: 'hello' }]);
      expect(iter.peekType()).toBe('insert');
    });

    it('returns "retain" for retain ops', () => {
      const iter = new OpIterator([{ retain: 5 }]);
      expect(iter.peekType()).toBe('retain');
    });

    it('returns "delete" for delete ops', () => {
      const iter = new OpIterator([{ delete: 3 }]);
      expect(iter.peekType()).toBe('delete');
    });

    it('returns "retain" when exhausted', () => {
      const iter = new OpIterator([]);
      expect(iter.peekType()).toBe('retain');
    });
  });

  describe('rest', () => {
    it('returns empty array when exhausted', () => {
      const iter = new OpIterator([{ insert: 'hi' }]);
      iter.next();
      expect(iter.rest()).toEqual([]);
    });

    it('returns all ops if nothing consumed', () => {
      const ops: Op[] = [{ insert: 'hello' }, { retain: 3 }];
      const iter = new OpIterator(ops);
      expect(iter.rest()).toEqual(ops);
    });

    it('returns remaining ops after some consumed', () => {
      const iter = new OpIterator([{ insert: 'hello' }, { retain: 3 }]);
      iter.next();
      expect(iter.rest()).toEqual([{ retain: 3 }]);
    });

    it('returns partial remaining op if partially consumed', () => {
      const iter = new OpIterator([{ insert: 'hello' }, { retain: 3 }]);
      iter.next(2);
      expect(iter.rest()).toEqual([{ insert: 'llo' }, { retain: 3 }]);
    });

    it('preserves attributes in partial rest', () => {
      const iter = new OpIterator([{ insert: 'hello', attributes: { bold: true } }, { retain: 3 }]);
      iter.next(2);
      expect(iter.rest()).toEqual([{ insert: 'llo', attributes: { bold: true } }, { retain: 3 }]);
    });

    it('handles partial retain in rest', () => {
      const iter = new OpIterator([{ retain: 5 }]);
      iter.next(2);
      expect(iter.rest()).toEqual([{ retain: 3 }]);
    });

    it('handles partial delete in rest', () => {
      const iter = new OpIterator([{ delete: 5 }]);
      iter.next(2);
      expect(iter.rest()).toEqual([{ delete: 3 }]);
    });
  });
});
