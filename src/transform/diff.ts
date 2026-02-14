import { diff as diffAttributes } from '../delta/AttributeMap';
import { Delta } from '../delta/Delta';
import { OpIterator } from '../delta/Iterator';
import type { AttributeMap, Op } from '../delta/Op';
import { isInsert, isTextInsert, opLength } from '../delta/Op';
import { DIFF_DELETE, DIFF_EQUAL, DIFF_INSERT, textDiff } from '../utils/text-diff';

/**
 * Calculate the difference between two document Deltas
 *
 * Returns a Delta that when composed with `a` produces `b`:
 * compose(a, diff(a, b)) === b
 *
 * Both `a` and `b` must be document Deltas (only inserts, no retain/delete)
 *
 * @param a - Original document
 * @param b - Target document
 * @param cursor - Optional cursor hint for better diff around cursor position
 * @returns Delta representing the changes from a to b
 */
export function diff(
  a: Delta,
  b: Delta,
  cursor?: number | { index: number; length: number },
): Delta {
  // Handle equal deltas quickly
  if (deltasEqual(a, b)) {
    return new Delta();
  }

  // Extract strings for text-based diff
  const stringsA = extractStrings(a);
  const stringsB = extractStrings(b);

  // Prepare cursor position for text diff
  let cursorPos: number | undefined;
  if (typeof cursor === 'number') {
    cursorPos = cursor;
  } else if (cursor && typeof cursor.index === 'number') {
    cursorPos = cursor.index;
  }

  // Perform text diff
  const diffResult = textDiff(stringsA.text, stringsB.text, cursorPos);

  const result = new Delta();
  const iterA = new OpIterator(a.ops);
  const iterB = new OpIterator(b.ops);

  for (const [type, text] of diffResult) {
    const length = text.length;

    switch (type) {
      case DIFF_INSERT:
        // Text was inserted - take from B with its attributes
        pushWithAttributes(result, iterB, length);
        break;

      case DIFF_DELETE:
        // Text was deleted - consume from A, emit delete
        result.delete(consumeLength(iterA, length));
        break;

      case DIFF_EQUAL:
        // Text is the same - check if attributes differ
        pushRetainOrAttributeChange(result, iterA, iterB, length);
        break;
    }
  }

  // Handle any remaining embed operations
  while (iterA.hasNext() || iterB.hasNext()) {
    if (iterA.hasNext() && !isTextInsert(iterA.peek())) {
      const opA = iterA.next();
      if (iterB.hasNext() && embedsEqual(opA, iterB.peek())) {
        // Same embed, check attributes
        const opB = iterB.next();
        const attrsDiff = diffAttributes(getAttributes(opA), getAttributes(opB));
        if (attrsDiff) {
          result.retain(1, attrsDiff);
        } else {
          result.retain(1);
        }
      } else {
        // Different embed - delete old
        result.delete(1);
      }
      continue;
    }

    if (iterB.hasNext() && !isTextInsert(iterB.peek())) {
      // Insert new embed
      result.push(iterB.next());
    }
  }

  return result.chop();
}

/**
 * Extract text content from a Delta, tracking embed positions
 */
function extractStrings(delta: Delta): { text: string; embeds: number[] } {
  let text = '';
  const embeds: number[] = [];

  for (const op of delta.ops) {
    if (isInsert(op)) {
      if (typeof op.insert === 'string') {
        text += op.insert;
      } else {
        // Embed - use null character as placeholder
        embeds.push(text.length);
        text += '\0';
      }
    }
  }

  return { text, embeds };
}

/**
 * Check if two Deltas are equal
 */
function deltasEqual(a: Delta, b: Delta): boolean {
  if (a.ops.length !== b.ops.length) {
    return false;
  }

  for (let i = 0; i < a.ops.length; i++) {
    const opA = a.ops[i];
    const opB = b.ops[i];
    if (!opA || !opB || !opsEqual(opA, opB)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two operations are equal
 */
function opsEqual(a: Op, b: Op): boolean {
  // Simple deep comparison for ops
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Check if two embed operations have the same embed value
 */
function embedsEqual(a: Op, b: Op): boolean {
  if (!isInsert(a) || !isInsert(b)) return false;
  if (typeof a.insert === 'string' || typeof b.insert === 'string') return false;
  return JSON.stringify(a.insert) === JSON.stringify(b.insert);
}

/**
 * Get attributes from an operation
 */
function getAttributes(op: Op): AttributeMap | undefined {
  if (isInsert(op)) {
    return op.attributes;
  }
  return undefined;
}

/**
 * Push operations from iterator with their attributes
 */
function pushWithAttributes(result: Delta, iter: OpIterator, length: number): void {
  let remaining = length;
  while (remaining > 0 && iter.hasNext()) {
    const op = iter.next(remaining);
    result.push(op);
    remaining -= opLength(op);
  }
}

/**
 * Consume length from iterator, return actual consumed length
 */
function consumeLength(iter: OpIterator, length: number): number {
  let consumed = 0;
  let remaining = length;
  while (remaining > 0 && iter.hasNext()) {
    const op = iter.next(remaining);
    const len = opLength(op);
    consumed += len;
    remaining -= len;
  }
  return consumed;
}

/**
 * For equal text, push retain or attribute changes
 * Also handles embed comparison when they appear as \0 in text diff
 */
function pushRetainOrAttributeChange(
  result: Delta,
  iterA: OpIterator,
  iterB: OpIterator,
  length: number,
): void {
  let remaining = length;

  while (remaining > 0 && iterA.hasNext() && iterB.hasNext()) {
    const lengthA = iterA.peekLength();
    const lengthB = iterB.peekLength();
    const consumeLength = Math.min(remaining, lengthA, lengthB);

    const opA = iterA.next(consumeLength);
    const opB = iterB.next(consumeLength);

    // Check if these are embeds (they show as \0 in text diff)
    const isEmbedA = isInsert(opA) && typeof opA.insert !== 'string';
    const isEmbedB = isInsert(opB) && typeof opB.insert !== 'string';

    if (isEmbedA && isEmbedB) {
      // Both are embeds - check if they're equal
      if (embedsEqual(opA, opB)) {
        // Same embed, check attributes
        const attrsDiff = diffAttributes(getAttributes(opA), getAttributes(opB));
        if (attrsDiff) {
          result.retain(1, attrsDiff);
        } else {
          result.retain(1);
        }
      } else {
        // Different embeds - delete old, insert new
        result.push(opB);
        result.delete(1);
      }
    } else {
      // Regular text comparison
      const attrsA = getAttributes(opA);
      const attrsB = getAttributes(opB);
      const attrsDiff = diffAttributes(attrsA, attrsB);

      if (attrsDiff) {
        result.retain(consumeLength, attrsDiff);
      } else {
        result.retain(consumeLength);
      }
    }

    remaining -= consumeLength;
  }
}
