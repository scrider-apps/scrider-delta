import { compose as composeAttributes } from '../delta/AttributeMap';
import { Delta } from '../delta/Delta';
import { OpIterator } from '../delta/Iterator';
import type { AttributeMap, Op } from '../delta/Op';
import { isDelete, isInsert, isRetain } from '../delta/Op';

/**
 * Compose two Deltas into one
 *
 * The resulting Delta represents applying `a` first, then `b`
 * This is the core operation for combining changes in OT
 *
 * @param a - First Delta (applied first)
 * @param b - Second Delta (applied second)
 * @returns New Delta that is equivalent to applying a then b
 */
export function compose(a: Delta, b: Delta): Delta {
  const result = new Delta();
  const iterA = new OpIterator(a.ops);
  const iterB = new OpIterator(b.ops);

  while (iterA.hasNext() || iterB.hasNext()) {
    // B inserts always come first (insertions from second operation)
    if (iterB.peekType() === 'insert') {
      result.push(iterB.next());
      continue;
    }

    // A deletes always pass through (deletions from first operation)
    if (iterA.peekType() === 'delete') {
      result.push(iterA.next());
      continue;
    }

    // At this point:
    // - B is either retain or delete
    // - A is either insert or retain

    const lengthA = iterA.peekLength();
    const lengthB = iterB.peekLength();
    const length = Math.min(lengthA, lengthB);

    const opA = iterA.next(length);
    const opB = iterB.next(length);

    // B retains (possibly with attributes)
    if (isRetain(opB)) {
      let newOp: Op;

      if (isRetain(opA)) {
        // retain + retain = retain with merged attributes
        const attrs = composeAttributes(opA.attributes, opB.attributes);
        newOp = attrs ? { retain: length, attributes: attrs } : { retain: length };
      } else if (isInsert(opA)) {
        // insert + retain = insert with merged attributes
        const attrs = composeAttributes(
          (opA as { attributes?: AttributeMap }).attributes,
          opB.attributes,
        );
        if (typeof opA.insert === 'string') {
          newOp = attrs ? { insert: opA.insert, attributes: attrs } : { insert: opA.insert };
        } else {
          newOp = attrs ? { insert: opA.insert, attributes: attrs } : { insert: opA.insert };
        }
      } else {
        // This shouldn't happen given the checks above
        continue;
      }

      result.push(newOp);
      continue;
    }

    // B deletes
    if (isDelete(opB)) {
      if (isRetain(opA)) {
        // retain + delete = delete
        result.push(opB);
      }
      // insert + delete = nothing (they cancel out)
      // We just don't push anything
      continue;
    }
  }

  return result.chop();
}
