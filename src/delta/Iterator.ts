import type { Op } from './Op';
import { isDelete, isInsert, isRetain, opLength } from './Op';

/**
 * Iterator for Delta operations with support for partial reads
 * Allows consuming operations in chunks smaller than their full length
 */
export class OpIterator {
  private ops: Op[];
  private index: number = 0;
  private offset: number = 0;

  constructor(ops: Op[]) {
    this.ops = ops;
  }

  /**
   * Check if there are more operations to iterate
   */
  hasNext(): boolean {
    return this.peekLength() < Infinity;
  }

  /**
   * Get next operation (or part of it)
   * @param length Maximum length to consume (default: Infinity = entire operation)
   */
  next(length: number = Infinity): Op {
    if (!this.hasNext()) {
      return { retain: Infinity };
    }

    const nextOp = this.ops[this.index];
    if (!nextOp) {
      return { retain: Infinity };
    }

    const opLen = opLength(nextOp);
    const remaining = opLen - this.offset;

    // How much to actually consume
    const consumeLength = Math.min(length, remaining);

    // Will this consume the entire remaining operation?
    const consumeEntire = consumeLength >= remaining;

    let result: Op;

    if (isInsert(nextOp)) {
      const insert = nextOp.insert;
      if (typeof insert === 'string') {
        // Text insert - return substring
        const start = this.offset;
        const end = this.offset + consumeLength;
        result = {
          insert: insert.substring(start, end),
          ...(nextOp.attributes ? { attributes: nextOp.attributes } : {}),
        };
      } else {
        // Embed - return entire embed (length is always 1)
        result = nextOp.attributes ? { insert, attributes: nextOp.attributes } : { insert };
      }
    } else if (isRetain(nextOp)) {
      result = nextOp.attributes
        ? { retain: consumeLength, attributes: nextOp.attributes }
        : { retain: consumeLength };
    } else if (isDelete(nextOp)) {
      result = { delete: consumeLength };
    } else {
      result = { retain: Infinity };
    }

    // Advance position
    if (consumeEntire) {
      this.index += 1;
      this.offset = 0;
    } else {
      this.offset += consumeLength;
    }

    return result;
  }

  /**
   * Peek at current operation without advancing
   */
  peek(): Op {
    if (this.index >= this.ops.length) {
      return { retain: Infinity };
    }
    return this.ops[this.index] ?? { retain: Infinity };
  }

  /**
   * Get remaining length of current operation
   */
  peekLength(): number {
    if (this.index >= this.ops.length) {
      return Infinity;
    }
    const op = this.ops[this.index];
    if (!op) {
      return Infinity;
    }
    return opLength(op) - this.offset;
  }

  /**
   * Get type of current operation
   */
  peekType(): 'insert' | 'retain' | 'delete' {
    const op = this.peek();
    if (isInsert(op)) return 'insert';
    if (isDelete(op)) return 'delete';
    return 'retain';
  }

  /**
   * Get all remaining operations
   */
  rest(): Op[] {
    if (!this.hasNext()) {
      return [];
    }

    // If we're in the middle of an operation, get the remainder
    if (this.offset > 0) {
      const result: Op[] = [];
      const currentOp = this.ops[this.index];

      if (currentOp) {
        const remaining = opLength(currentOp) - this.offset;

        if (isInsert(currentOp)) {
          if (typeof currentOp.insert === 'string') {
            result.push({
              insert: currentOp.insert.substring(this.offset),
              ...(currentOp.attributes ? { attributes: currentOp.attributes } : {}),
            });
          } else {
            // Embed - shouldn't have offset > 0, but handle gracefully
            result.push(currentOp);
          }
        } else if (isRetain(currentOp)) {
          result.push({
            retain: remaining,
            ...(currentOp.attributes ? { attributes: currentOp.attributes } : {}),
          });
        } else if (isDelete(currentOp)) {
          result.push({ delete: remaining });
        }
      }

      return result.concat(this.ops.slice(this.index + 1));
    }

    return this.ops.slice(this.index);
  }
}
