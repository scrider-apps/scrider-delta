import { describe, expect, it } from 'vitest';
import type {
  AttributeMap,
  DeleteOp,
  InsertOp,
  InsertValue,
  Op,
  ParsedScriderDocument,
  RetainOp,
  ScriderDocument,
} from '../src/index';
import {
  AttributeMapUtils,
  deepClone,
  deepEqual,
  Delta,
  isDelete,
  isEmbedInsert,
  isInsert,
  isRetain,
  isScriderDocument,
  isTextInsert,
  OpIterator,
  opLength,
  opType,
  parseDocument,
  SCRIDER_METADATA_KEY,
  serializeDocument,
  VERSION,
} from '../src/index';

describe('Public API exports (@scrider/delta)', () => {
  it('exports VERSION', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('exports Delta class', () => {
    expect(Delta).toBeDefined();
    const delta = new Delta();
    expect(delta).toBeInstanceOf(Delta);
  });

  it('exports OpIterator class', () => {
    expect(OpIterator).toBeDefined();
    const iter = new OpIterator([]);
    expect(iter).toBeInstanceOf(OpIterator);
  });

  it('exports AttributeMapUtils', () => {
    expect(AttributeMapUtils).toBeDefined();
    expect(AttributeMapUtils.compose).toBeDefined();
    expect(AttributeMapUtils.diff).toBeDefined();
    expect(AttributeMapUtils.invert).toBeDefined();
    expect(AttributeMapUtils.transform).toBeDefined();
  });

  it('exports type guards', () => {
    expect(isInsert).toBeDefined();
    expect(isRetain).toBeDefined();
    expect(isDelete).toBeDefined();
    expect(isTextInsert).toBeDefined();
    expect(isEmbedInsert).toBeDefined();
  });

  it('exports op utilities', () => {
    expect(opLength).toBeDefined();
    expect(opType).toBeDefined();
  });

  it('exports deep utilities', () => {
    expect(deepEqual).toBeDefined();
    expect(deepClone).toBeDefined();
  });

  it('exports document container helpers', () => {
    expect(serializeDocument).toBeDefined();
    expect(parseDocument).toBeDefined();
    expect(isScriderDocument).toBeDefined();
    expect(SCRIDER_METADATA_KEY).toBe('scrider-metadata');
  });

  it('document helpers round-trip through the public API', () => {
    const doc = serializeDocument(new Delta().insert('Hi\n'), { lineSpacing: 1.5 });
    const parsed = parseDocument(JSON.stringify(doc));

    expect(parsed.delta.ops).toEqual([{ insert: 'Hi\n' }]);
    expect(parsed.metadata).toEqual({ lineSpacing: 1.5 });
  });

  it('Delta can be used with method chaining', () => {
    const delta = new Delta()
      .insert('Hello', { bold: true })
      .insert(' World')
      .insert('\n', { header: 1 });

    expect(delta.ops).toEqual([
      { insert: 'Hello', attributes: { bold: true } },
      { insert: ' World' },
      { insert: '\n', attributes: { header: 1 } },
    ]);
  });

  it('type guards work correctly', () => {
    const insertOp: Op = { insert: 'hello' };
    const retainOp: Op = { retain: 5 };
    const deleteOp: Op = { delete: 3 };

    expect(isInsert(insertOp)).toBe(true);
    expect(isRetain(retainOp)).toBe(true);
    expect(isDelete(deleteOp)).toBe(true);
  });

  it('AttributeMapUtils.compose works', () => {
    const result = AttributeMapUtils.compose({ bold: true }, { italic: true });
    expect(result).toEqual({ bold: true, italic: true });
  });
});

// Type-only tests (compile-time verification)
describe('Type exports (@scrider/delta)', () => {
  it('Op type is usable', () => {
    const op: Op = { insert: 'test' };
    expect(op).toBeDefined();
  });

  it('InsertOp type is usable', () => {
    const op: InsertOp = { insert: 'test', attributes: { bold: true } };
    expect(op).toBeDefined();
  });

  it('RetainOp type is usable', () => {
    const op: RetainOp = { retain: 5 };
    expect(op).toBeDefined();
  });

  it('DeleteOp type is usable', () => {
    const op: DeleteOp = { delete: 3 };
    expect(op).toBeDefined();
  });

  it('AttributeMap type is usable', () => {
    const attrs: AttributeMap = { bold: true, color: '#ff0000' };
    expect(attrs).toBeDefined();
  });

  it('InsertValue type is usable', () => {
    const text: InsertValue = 'hello';
    const embed: InsertValue = { image: 'url' };
    expect(text).toBeDefined();
    expect(embed).toBeDefined();
  });

  it('ScriderDocument type is usable', () => {
    const doc: ScriderDocument = {
      ops: [{ insert: 'hi\n' }],
      'scrider-metadata': { lineSpacing: 1.5 },
    };
    expect(doc).toBeDefined();
  });

  it('ParsedScriderDocument type is usable', () => {
    const parsed: ParsedScriderDocument = { delta: new Delta(), metadata: { lineSpacing: 1 } };
    expect(parsed).toBeDefined();
  });
});
