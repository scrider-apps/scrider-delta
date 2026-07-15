import { deepClone } from '../utils/clone';
import { Delta } from './Delta';
import { isInsert, isRetain, isDelete, type Op } from './Op';

/**
 * Persisted JSON key for document-level metadata (Scrider format extension).
 *
 * The value lives as a SIBLING of `ops`, never as an embed inside the op-stream,
 * so it does not participate in `length()`, selection indices, OT operations
 * (compose / transform / diff / invert), or partial copy / paste.
 */
export const SCRIDER_METADATA_KEY = 'scrider-metadata';

/**
 * A Scrider document: an op-stream plus optional document-level metadata.
 *
 * Metadata is opaque to `@scrider/delta` (its concrete schema is defined by
 * upstream layers such as the formatter or editor). It carries document-wide
 * defaults (line spacing, paragraph spacing, indent, etc.) once, instead of
 * duplicating them as block attributes on every `\n`.
 *
 * This wrapper is a Scrider format extension: it is NOT a plain Quill Delta.
 * Fragments (copy / paste) should be exchanged as `ops` only, without metadata.
 */
export interface ScriderDocument {
  ops: Op[];
  'scrider-metadata'?: Record<string, unknown>;
}

/**
 * Result of parsing a `ScriderDocument`: the op-stream as a `Delta` plus the
 * optional metadata. Metadata is omitted when absent or empty.
 */
export interface ParsedScriderDocument {
  delta: Delta;
  metadata?: Record<string, unknown>;
}

function isOpArray(value: unknown): value is Op[] {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((op) => {
    if (op === null || typeof op !== 'object') {
      return false;
    }
    const candidate = op as Op;
    return isInsert(candidate) || isRetain(candidate) || isDelete(candidate);
  });
}

function isNonEmptyMetadata(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).length > 0
  );
}

/**
 * Type guard for a `ScriderDocument`: an object with a valid `ops` array.
 */
export function isScriderDocument(value: unknown): value is ScriderDocument {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  return isOpArray((value as { ops?: unknown }).ops);
}

/**
 * Build a JSON-ready `ScriderDocument` from a `Delta` and optional metadata.
 *
 * The `ops` array and the metadata are deep-cloned so the result is isolated
 * from later mutation. Empty or absent metadata is omitted from the output.
 */
export function serializeDocument(
  delta: Delta,
  metadata?: Record<string, unknown>,
): ScriderDocument {
  const doc: ScriderDocument = { ops: deepClone(delta.ops) };
  if (isNonEmptyMetadata(metadata)) {
    doc[SCRIDER_METADATA_KEY] = deepClone(metadata);
  }
  return doc;
}

/**
 * Parse a `ScriderDocument` (a parsed object or a JSON string) into a `Delta`
 * and optional metadata.
 *
 * @throws Error if the value is not a valid document (missing or invalid `ops`).
 */
export function parseDocument(value: unknown): ParsedScriderDocument {
  const source: unknown = typeof value === 'string' ? JSON.parse(value) : value;

  if (source === null || typeof source !== 'object') {
    throw new Error('parseDocument: expected an object or JSON string');
  }

  const ops = (source as { ops?: unknown }).ops;
  if (!isOpArray(ops)) {
    throw new Error('parseDocument: document is missing a valid "ops" array');
  }

  const result: ParsedScriderDocument = { delta: new Delta(deepClone(ops)) };

  const metadata = (source as Record<string, unknown>)[SCRIDER_METADATA_KEY];
  if (isNonEmptyMetadata(metadata)) {
    result.metadata = deepClone(metadata);
  }

  return result;
}
