import { invert as invertAttributes } from '../delta/AttributeMap';
import { Delta } from '../delta/Delta';
import { OpIterator } from '../delta/Iterator';
import type { AttributeMap } from '../delta/Op';
import { isDelete, isInsert, isRetain, opLength } from '../delta/Op';

/**
 * Invert a change Delta against a base document
 *
 * Returns a Delta that undoes the change:
 * compose(compose(base, change), invert(change, base)) === base
 *
 * @param change - The change Delta to invert
 * @param base - The base document the change was applied to
 * @returns Delta that undoes the change
 */
export function invert(change: Delta, base: Delta): Delta {
  const result = new Delta();
  const baseIter = new OpIterator(base.ops);

  for (const op of change.ops) {
    if (isInsert(op)) {
      // Insert in change -> delete in inverse
      result.delete(opLength(op));
    } else if (isRetain(op)) {
      const length = op.retain;

      if (op.attributes) {
        // Retain with attributes -> retain with inverted attributes
        // We need to get the base attributes for this range
        let remaining = length;

        while (remaining > 0 && baseIter.hasNext()) {
          const baseLength = Math.min(baseIter.peekLength(), remaining);
          const baseOp = baseIter.next(baseLength);

          const baseAttrs: AttributeMap | undefined =
            isInsert(baseOp) && baseOp.attributes ? baseOp.attributes : undefined;

          const invertedAttrs = invertAttributes(op.attributes, baseAttrs);

          if (Object.keys(invertedAttrs).length > 0) {
            result.retain(baseLength, invertedAttrs);
          } else {
            result.retain(baseLength);
          }

          remaining -= baseLength;
        }
      } else {
        // Plain retain -> just retain
        result.retain(length);

        // Advance base iterator
        let remaining = length;
        while (remaining > 0 && baseIter.hasNext()) {
          const consumed = Math.min(baseIter.peekLength(), remaining);
          baseIter.next(consumed);
          remaining -= consumed;
        }
      }
    } else if (isDelete(op)) {
      // Delete in change -> insert base content in inverse
      const length = op.delete;
      let remaining = length;

      while (remaining > 0 && baseIter.hasNext()) {
        const baseLength = Math.min(baseIter.peekLength(), remaining);
        const baseOp = baseIter.next(baseLength);

        // Re-insert what was deleted
        result.push(baseOp);

        remaining -= baseLength;
      }
    }
  }

  return result.chop();
}
