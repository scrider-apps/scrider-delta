import { describe, expect, it } from 'vitest';
import {
  isDelete,
  isEmbedInsert,
  isInsert,
  isRetain,
  isTextInsert,
  opLength,
  opType,
  type DeleteOp,
  type InsertOp,
  type Op,
  type RetainOp,
} from '../../src/delta/Op';

describe('Op types', () => {
  describe('type guards', () => {
    it('isInsert returns true for insert ops', () => {
      const op: Op = { insert: 'hello' };
      expect(isInsert(op)).toBe(true);
      expect(isRetain(op)).toBe(false);
      expect(isDelete(op)).toBe(false);
    });

    it('isInsert returns true for insert with attributes', () => {
      const op: Op = { insert: 'hello', attributes: { bold: true } };
      expect(isInsert(op)).toBe(true);
    });

    it('isRetain returns true for retain ops', () => {
      const op: Op = { retain: 5 };
      expect(isRetain(op)).toBe(true);
      expect(isInsert(op)).toBe(false);
      expect(isDelete(op)).toBe(false);
    });

    it('isRetain returns true for retain with attributes', () => {
      const op: Op = { retain: 5, attributes: { bold: true } };
      expect(isRetain(op)).toBe(true);
    });

    it('isDelete returns true for delete ops', () => {
      const op: Op = { delete: 3 };
      expect(isDelete(op)).toBe(true);
      expect(isInsert(op)).toBe(false);
      expect(isRetain(op)).toBe(false);
    });

    it('isTextInsert returns true for text inserts', () => {
      const textOp: Op = { insert: 'hello' };
      const embedOp: Op = { insert: { image: 'url' } };

      expect(isTextInsert(textOp)).toBe(true);
      expect(isTextInsert(embedOp)).toBe(false);
    });

    it('isEmbedInsert returns true for embed inserts', () => {
      const textOp: Op = { insert: 'hello' };
      const embedOp: Op = { insert: { image: 'url' } };

      expect(isEmbedInsert(embedOp)).toBe(true);
      expect(isEmbedInsert(textOp)).toBe(false);
    });

    it('isEmbedInsert returns false for non-insert ops', () => {
      const retainOp: Op = { retain: 5 };
      const deleteOp: Op = { delete: 3 };

      expect(isEmbedInsert(retainOp)).toBe(false);
      expect(isEmbedInsert(deleteOp)).toBe(false);
    });
  });

  describe('opLength', () => {
    it('returns string length for text inserts', () => {
      const op: InsertOp = { insert: 'hello' };
      expect(opLength(op)).toBe(5);
    });

    it('returns 1 for embed inserts', () => {
      const op: InsertOp = { insert: { image: 'url' } };
      expect(opLength(op)).toBe(1);
    });

    it('returns 0 for empty string insert', () => {
      const op: InsertOp = { insert: '' };
      expect(opLength(op)).toBe(0);
    });

    it('returns retain count for retain ops', () => {
      const op: RetainOp = { retain: 10 };
      expect(opLength(op)).toBe(10);
    });

    it('returns delete count for delete ops', () => {
      const op: DeleteOp = { delete: 7 };
      expect(opLength(op)).toBe(7);
    });
  });

  describe('opType', () => {
    it('returns "insert" for insert ops', () => {
      expect(opType({ insert: 'text' })).toBe('insert');
      expect(opType({ insert: { image: 'url' } })).toBe('insert');
    });

    it('returns "retain" for retain ops', () => {
      expect(opType({ retain: 5 })).toBe('retain');
    });

    it('returns "delete" for delete ops', () => {
      expect(opType({ delete: 3 })).toBe('delete');
    });
  });
});
