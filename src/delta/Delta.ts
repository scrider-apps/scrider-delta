import { deepClone } from '../utils/clone';
import { deepEqual } from '../utils/equal';
import { OpIterator } from './Iterator';
import type { AttributeMap, InsertOp, InsertValue, Op, RetainOp } from './Op';
import { isDelete, isInsert, isRetain, isTextInsert, opLength } from './Op';

// Transform operations (imported as functions to avoid method duplication)
import { compose as composeDeltas } from '../transform/compose';
import { diff as diffDeltas } from '../transform/diff';
import { invert as invertDelta } from '../transform/invert';
import {
  transform as transformDelta,
  transformPosition as transformPos,
} from '../transform/transform';

/**
 * Get attributes from an operation (returns undefined for delete ops)
 */
function getOpAttributes(op: Op): AttributeMap | undefined {
  if (isInsert(op) || isRetain(op)) {
    return op.attributes;
  }
  return undefined;
}

/**
 * Delta represents a document or a change to a document
 * It is a list of operations that describe rich-text content
 */
export class Delta {
  /**
   * The operations that make up this Delta
   * Readonly to prevent direct mutation - use methods instead
   */
  readonly ops: Op[];

  /**
   * Create a new Delta
   * @param ops - Initial operations (array, Delta, or object with ops)
   */
  constructor(ops?: Op[] | Delta | { ops: Op[] }) {
    if (Array.isArray(ops)) {
      this.ops = ops;
    } else if (ops instanceof Delta) {
      this.ops = ops.ops.slice();
    } else if (ops && Array.isArray(ops.ops)) {
      this.ops = ops.ops.slice();
    } else {
      this.ops = [];
    }
  }

  // ============================================================================
  // Chainable Builders
  // ============================================================================

  /**
   * Add an insert operation
   * @param value - Text string or embed object to insert
   * @param attributes - Optional formatting attributes
   * @throws Error if value is invalid
   */
  insert(value: InsertValue, attributes?: AttributeMap): this {
    if (typeof value === 'string') {
      if (value.length === 0) {
        return this;
      }
    } else if (typeof value !== 'object' || value === null) {
      throw new Error('Insert value must be a string or embed object');
    }

    const op: InsertOp = { insert: value };
    if (attributes && Object.keys(attributes).length > 0) {
      op.attributes = deepClone(attributes);
    }
    return this.push(op);
  }

  /**
   * Add a delete operation
   * @param length - Number of characters to delete
   * @throws Error if length is not a positive integer
   */
  delete(length: number): this {
    if (length <= 0) {
      if (length === 0) return this;
      throw new Error('Delete length must be positive');
    }
    if (!Number.isInteger(length)) {
      throw new Error('Delete length must be an integer');
    }
    return this.push({ delete: length });
  }

  /**
   * Add a retain operation
   * @param length - Number of characters to retain
   * @param attributes - Optional formatting changes
   * @throws Error if length is not a positive integer
   */
  retain(length: number, attributes?: AttributeMap): this {
    if (length <= 0) {
      if (length === 0) return this;
      throw new Error('Retain length must be positive');
    }
    if (!Number.isInteger(length)) {
      throw new Error('Retain length must be an integer');
    }
    const op: RetainOp = { retain: length };
    if (attributes && Object.keys(attributes).length > 0) {
      op.attributes = deepClone(attributes);
    }
    return this.push(op);
  }

  /**
   * Push an operation with automatic compaction
   * Merges with the last operation if they are compatible
   */
  push(newOp: Op): this {
    // Work with internal mutable array (readonly is for external API)
    const ops = this.ops as unknown as Op[];
    let index = ops.length;
    let lastOp = ops[index - 1];

    // Clone to avoid external mutation
    newOp = deepClone(newOp);

    // Handle trailing delete - merge deletes
    if (isDelete(newOp) && lastOp && isDelete(lastOp)) {
      ops[index - 1] = { delete: lastOp.delete + newOp.delete };
      return this;
    }

    // Insert should go before delete for normalization
    if (lastOp && isDelete(lastOp) && isInsert(newOp)) {
      index -= 1;
      lastOp = ops[index - 1];
      if (lastOp === undefined) {
        ops.unshift(newOp);
        return this;
      }
    }

    // Try to merge with last operation (only non-delete ops have attributes)
    const newAttrs = getOpAttributes(newOp);
    const lastAttrs = lastOp ? getOpAttributes(lastOp) : undefined;

    if (lastOp && deepEqual(newAttrs, lastAttrs)) {
      // Merge text inserts
      if (isTextInsert(newOp) && isTextInsert(lastOp)) {
        const merged: InsertOp = {
          insert: lastOp.insert + newOp.insert,
        };
        if (lastOp.attributes) {
          merged.attributes = lastOp.attributes;
        }
        ops[index - 1] = merged;
        return this;
      }
      // Merge retains
      if (isRetain(newOp) && isRetain(lastOp)) {
        const merged: RetainOp = {
          retain: lastOp.retain + newOp.retain,
        };
        if (lastOp.attributes) {
          merged.attributes = lastOp.attributes;
        }
        ops[index - 1] = merged;
        return this;
      }
    }

    // Cannot merge, just push
    if (index === ops.length) {
      ops.push(newOp);
    } else {
      ops.splice(index, 0, newOp);
    }

    return this;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get the length of the document
   * Only counts insert operations (document content)
   */
  length(): number {
    return this.ops.reduce((acc, op) => {
      if (isInsert(op)) {
        return acc + opLength(op);
      }
      return acc;
    }, 0);
  }

  /**
   * Get the change in length this Delta would cause
   * Positive = document grows, negative = shrinks
   */
  changeLength(): number {
    return this.ops.reduce((acc, op) => {
      if (isInsert(op)) {
        return acc + opLength(op);
      }
      if (isDelete(op)) {
        return acc - op.delete;
      }
      return acc;
    }, 0);
  }

  /**
   * Get a slice of this Delta by character position
   */
  slice(start: number = 0, end: number = Infinity): Delta {
    const result = new Delta();
    const iter = new OpIterator(this.ops);
    let index = 0;

    while (index < end && iter.hasNext()) {
      let nextOp: Op;
      if (index < start) {
        // Skip until start
        nextOp = iter.next(start - index);
        index += opLength(nextOp);
      } else {
        // Include operations until end
        nextOp = iter.next(end - index);
        index += opLength(nextOp);
        result.push(nextOp);
      }
    }

    return result;
  }

  /**
   * Concatenate another Delta to this one
   * Returns a new Delta
   */
  concat(other: Delta): Delta {
    const result = new Delta(this.ops.slice());

    if (other.ops.length === 0) {
      return result;
    }

    // Push first op of other (may merge with last of this)
    const firstOp = other.ops[0];
    if (firstOp) {
      result.push(firstOp);
    }

    // Push remaining ops directly
    const resultOps = result.ops as unknown as Op[];
    for (let i = 1; i < other.ops.length; i++) {
      const op = other.ops[i];
      if (op) {
        resultOps.push(deepClone(op));
      }
    }

    return result;
  }

  /**
   * Iterate over lines in the document
   * @param callback - Called for each line (Delta, line attributes, line index)
   *                   Return false to stop iteration
   * @param newline - Newline character (default: '\n')
   */
  eachLine(
    callback: (line: Delta, attributes: AttributeMap, index: number) => boolean | void,
    newline: string = '\n',
  ): void {
    const iter = new OpIterator(this.ops);
    let line = new Delta();
    let lineIndex = 0;

    while (iter.hasNext()) {
      // Check if we're at end of document without final newline
      if (iter.peekType() !== 'insert') {
        return;
      }

      const op = iter.peek();
      if (!isTextInsert(op)) {
        // Embed - add to current line
        line.push(iter.next());
        continue;
      }

      const text = op.insert;
      const nlIndex = text.indexOf(newline, 0);

      if (nlIndex < 0) {
        // No newline in this op - add to current line
        line.push(iter.next());
      } else {
        // Has newline - split the op
        const consumed = iter.next(nlIndex + 1);
        const lineAttrs: AttributeMap =
          isInsert(consumed) && consumed.attributes ? consumed.attributes : {};

        // Text before newline goes to current line
        if (nlIndex > 0 && isTextInsert(consumed)) {
          const lineOp: InsertOp = {
            insert: consumed.insert.slice(0, -1),
          };
          if (consumed.attributes) {
            lineOp.attributes = consumed.attributes;
          }
          line.push(lineOp);
        }

        // Callback with completed line
        if (callback(line, lineAttrs, lineIndex) === false) {
          return;
        }

        // Start new line
        line = new Delta();
        lineIndex += 1;
      }
    }

    // Handle last line if no trailing newline
    if (line.ops.length > 0) {
      callback(line, {}, lineIndex);
    }
  }

  // ============================================================================
  // Iteration Methods
  // ============================================================================

  /**
   * Filter operations
   */
  filter(predicate: (op: Op, index: number) => boolean): Op[] {
    return this.ops.filter(predicate);
  }

  /**
   * Iterate over operations
   */
  forEach(callback: (op: Op, index: number) => void): void {
    this.ops.forEach(callback);
  }

  /**
   * Map operations
   */
  map<T>(callback: (op: Op, index: number) => T): T[] {
    return this.ops.map(callback);
  }

  /**
   * Reduce operations
   */
  reduce<T>(callback: (acc: T, op: Op, index: number) => T, initial: T): T {
    return this.ops.reduce(callback, initial);
  }

  /**
   * Partition operations into two arrays based on predicate
   */
  partition(predicate: (op: Op) => boolean): [Op[], Op[]] {
    const passed: Op[] = [];
    const failed: Op[] = [];
    for (const op of this.ops) {
      if (predicate(op)) {
        passed.push(op);
      } else {
        failed.push(op);
      }
    }
    return [passed, failed];
  }

  // ============================================================================
  // Chop (remove trailing retains)
  // ============================================================================

  /**
   * Remove trailing retain operations (only for change deltas)
   * Returns this for chaining
   */
  chop(): this {
    const ops = this.ops as unknown as Op[];
    let lastOp = ops[ops.length - 1];
    while (lastOp && isRetain(lastOp) && !lastOp.attributes) {
      ops.pop();
      lastOp = ops[ops.length - 1];
    }
    return this;
  }

  // ============================================================================
  // Transform Operations (OT)
  // ============================================================================

  /**
   * Compose this Delta with another
   * Returns a new Delta that is equivalent to applying this, then other
   *
   * @param other - Delta to compose with
   * @returns New composed Delta
   */
  compose(other: Delta): Delta {
    return composeDeltas(this, other);
  }

  /**
   * Transform another Delta against this one
   *
   * Given that this Delta has been applied, transform `other` so that
   * when applied to the result, we get the same outcome as if
   * both were applied to the original in different order.
   *
   * @param other - Delta to transform
   * @param priority - If true, other takes precedence on conflicts
   * @returns Transformed Delta
   */
  transform(other: Delta, priority: boolean = false): Delta {
    return transformDelta(this, other, priority);
  }

  /**
   * Transform a cursor position against this Delta
   *
   * @param index - Cursor position
   * @param priority - If true, cursor "sticks" to the right of insertions
   * @returns New cursor position
   */
  transformPosition(index: number, priority: boolean = false): number {
    return transformPos(this, index, priority);
  }

  /**
   * Calculate the difference between this and another Delta
   *
   * Returns a Delta that when composed with this produces other:
   * this.compose(this.diff(other)) equals other
   *
   * Both Deltas must be document Deltas (only inserts)
   *
   * @param other - Target document
   * @param cursor - Optional cursor hint for better diff
   * @returns Delta representing the changes
   */
  diff(other: Delta, cursor?: number | { index: number; length: number }): Delta {
    return diffDeltas(this, other, cursor);
  }

  /**
   * Invert this change Delta against a base document
   *
   * Returns a Delta that undoes this change:
   * base.compose(change).compose(change.invert(base)) equals base
   *
   * @param base - The base document this change was applied to
   * @returns Delta that undoes this change
   */
  invert(base: Delta): Delta {
    return invertDelta(this, base);
  }
}
