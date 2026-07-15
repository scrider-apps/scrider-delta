import { describe, expect, it } from 'vitest';
import { Delta } from '../../src/delta/Delta';
import {
  SCRIDER_METADATA_KEY,
  isScriderDocument,
  parseDocument,
  serializeDocument,
} from '../../src/delta/Document';

describe('ScriderDocument container', () => {
  describe('serializeDocument', () => {
    it('serializes a Delta without metadata to { ops } only', () => {
      const delta = new Delta().insert('Hello\n');
      const doc = serializeDocument(delta);

      expect(doc).toEqual({ ops: [{ insert: 'Hello\n' }] });
      expect(SCRIDER_METADATA_KEY in doc).toBe(false);
    });

    it('includes non-empty metadata under the scrider-metadata key', () => {
      const delta = new Delta().insert('Hello\n');
      const doc = serializeDocument(delta, { lineSpacing: 1.5 });

      expect(doc).toEqual({
        ops: [{ insert: 'Hello\n' }],
        'scrider-metadata': { lineSpacing: 1.5 },
      });
    });

    it('omits empty metadata objects', () => {
      const delta = new Delta().insert('Hello\n');
      const doc = serializeDocument(delta, {});

      expect(SCRIDER_METADATA_KEY in doc).toBe(false);
    });

    it('deep-clones ops so later Delta mutation does not leak', () => {
      const delta = new Delta().insert('Hello\n');
      const doc = serializeDocument(delta);

      delta.insert('World\n');

      expect(doc.ops).toEqual([{ insert: 'Hello\n' }]);
    });

    it('deep-clones metadata so later mutation does not leak', () => {
      const delta = new Delta().insert('Hello\n');
      const metadata: Record<string, unknown> = { nested: { value: 1 } };
      const doc = serializeDocument(delta, metadata);

      (metadata.nested as { value: number }).value = 2;

      expect(doc[SCRIDER_METADATA_KEY]).toEqual({ nested: { value: 1 } });
    });
  });

  describe('parseDocument', () => {
    it('parses a plain object into a Delta', () => {
      const { delta, metadata } = parseDocument({ ops: [{ insert: 'Hi\n' }] });

      expect(delta).toBeInstanceOf(Delta);
      expect(delta.ops).toEqual([{ insert: 'Hi\n' }]);
      expect(metadata).toBeUndefined();
    });

    it('parses a JSON string', () => {
      const json = JSON.stringify({
        ops: [{ insert: 'Hi\n' }],
        'scrider-metadata': { lineSpacing: 2 },
      });
      const { delta, metadata } = parseDocument(json);

      expect(delta.ops).toEqual([{ insert: 'Hi\n' }]);
      expect(metadata).toEqual({ lineSpacing: 2 });
    });

    it('omits empty metadata on parse', () => {
      const { metadata } = parseDocument({ ops: [{ insert: 'Hi\n' }], 'scrider-metadata': {} });
      expect(metadata).toBeUndefined();
    });

    it('deep-clones ops so mutating the source does not affect the Delta', () => {
      const source = { ops: [{ insert: 'Hi\n' }] };
      const { delta } = parseDocument(source);

      source.ops[0]!.insert = 'changed\n';

      expect(delta.ops).toEqual([{ insert: 'Hi\n' }]);
    });

    it('throws when ops is missing', () => {
      expect(() => parseDocument({})).toThrow(/ops/);
    });

    it('throws when ops is not a valid op array', () => {
      expect(() => parseDocument({ ops: [{ foo: 'bar' }] })).toThrow(/ops/);
    });

    it('throws on non-object input', () => {
      expect(() => parseDocument(42)).toThrow();
    });
  });

  describe('round-trip', () => {
    it('serialize -> JSON -> parse preserves ops and metadata', () => {
      const delta = new Delta().insert('World', { bold: true }).insert('\n', { header: 1 });
      const metadata = { lineSpacing: 1.5, textIndentCm: 1.25 };

      const json = JSON.stringify(serializeDocument(delta, metadata));
      const parsed = parseDocument(json);

      expect(parsed.delta.ops).toEqual(delta.ops);
      expect(parsed.metadata).toEqual(metadata);
    });
  });

  describe('isScriderDocument', () => {
    it('accepts an object with a valid ops array', () => {
      expect(isScriderDocument({ ops: [{ insert: 'x\n' }] })).toBe(true);
      expect(isScriderDocument({ ops: [] })).toBe(true);
    });

    it('rejects invalid shapes', () => {
      expect(isScriderDocument(null)).toBe(false);
      expect(isScriderDocument('string')).toBe(false);
      expect(isScriderDocument({})).toBe(false);
      expect(isScriderDocument({ ops: 'not-array' })).toBe(false);
      expect(isScriderDocument({ ops: [{ foo: 'bar' }] })).toBe(false);
    });
  });
});
