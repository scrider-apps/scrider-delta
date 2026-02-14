import { transform as transformAttributes } from '../delta/AttributeMap';
import { Delta } from '../delta/Delta';
import { OpIterator } from '../delta/Iterator';
import { isDelete, opLength } from '../delta/Op';

/**
 * Transform Delta `b` against Delta `a`
 *
 * Given that `a` has already been applied, transform `b` so that
 * when applied to the result, we get the same outcome as if
 * both were applied to the original in different order.
 *
 * This is the key OT operation for collaborative editing.
 *
 * The `priority` parameter determines who "wins" when both insert
 * at the same position:
 * - priority = true: `b` wins (b's insert comes first)
 * - priority = false: `a` wins (a's insert comes first)
 *
 * @param a - Delta that has been applied
 * @param b - Delta to transform
 * @param priority - If true, b takes precedence on conflicts
 * @returns Transformed Delta b'
 */
export function transform(a: Delta, b: Delta, priority: boolean = false): Delta {
  const result = new Delta();
  const iterA = new OpIterator(a.ops);
  const iterB = new OpIterator(b.ops);

  while (iterA.hasNext() || iterB.hasNext()) {
    // If A inserts, B needs to retain over it
    // Exception: if B also inserts and has priority, B goes first
    if (iterA.peekType() === 'insert') {
      // If B also inserts, check priority
      if (iterB.peekType() === 'insert' && priority) {
        // B has priority, B's insert goes first
        result.push(iterB.next());
        continue;
      }
      // A's insert goes first, B needs to retain over it
      const opA = iterA.next();
      result.retain(opLength(opA));
      continue;
    }

    // If B inserts, just keep the insert
    if (iterB.peekType() === 'insert') {
      result.push(iterB.next());
      continue;
    }

    // At this point both are either retain or delete
    const lengthA = iterA.peekLength();
    const lengthB = iterB.peekLength();
    const length = Math.min(lengthA, lengthB);

    const opA = iterA.next(length);
    const opB = iterB.next(length);

    // A deletes - B's operation becomes no-op (content is already deleted)
    if (isDelete(opA)) {
      // B's retain or delete on deleted content - skip
      continue;
    }

    // A retains
    if (isDelete(opB)) {
      // B deletes
      result.push(opB);
    } else {
      // Both retain - transform attributes
      const attrs = transformAttributes(
        (opA as { attributes?: Record<string, unknown> }).attributes,
        (opB as { attributes?: Record<string, unknown> }).attributes,
        priority,
      );
      if (attrs) {
        result.retain(length, attrs);
      } else {
        result.retain(length);
      }
    }
  }

  return result.chop();
}

/**
 * Transform an index/position against a Delta
 *
 * Given that the Delta has been applied, where would the cursor
 * at `index` end up?
 *
 * @param delta - Delta that has been applied
 * @param index - Original cursor position
 * @param priority - If true, cursor "sticks" to the right of insertions at same position
 * @returns New cursor position
 */
export function transformPosition(delta: Delta, index: number, priority: boolean = false): number {
  let position = 0;
  const iter = new OpIterator(delta.ops);

  while (iter.hasNext() && position <= index) {
    const length = iter.peekLength();
    const opType = iter.peekType();

    // For insert at exactly our position, priority determines if we move
    if (opType === 'insert') {
      const op = iter.next();
      const insertLength = opLength(op);

      // If priority is true, cursor stays before insert
      // If priority is false, cursor moves after insert
      if (position < index || !priority) {
        index += insertLength;
      }
      continue;
    }

    if (opType === 'delete') {
      const consume = Math.min(length, index - position);
      if (consume === 0) break; // Nothing left to consume, exit loop
      iter.next(consume);
      index -= consume;
      continue;
    }

    // Retain - just move position forward
    const consumed = Math.min(length, index - position);
    if (consumed === 0) break; // Nothing left to consume, exit loop
    iter.next(consumed);
    position += consumed;
  }

  return index;
}
