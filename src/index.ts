/**
 * @scrider/delta
 * Core Delta class and OT operations
 */

export const VERSION = '1.0.0';

// Core Delta class
export { Delta } from './delta/Delta';

// Operation types
export type { AttributeMap, DeleteOp, InsertOp, InsertValue, Op, RetainOp } from './delta/Op';

// Type guards and utilities
export {
  isDelete,
  isEmbedInsert,
  isInsert,
  isRetain,
  isTextInsert,
  opLength,
  opType,
} from './delta/Op';

// Iterator
export { OpIterator } from './delta/Iterator';

// AttributeMap utilities (namespaced export)
export * as AttributeMapUtils from './delta/AttributeMap';

// Transform operations (OT)
export { compose, diff, invert, transform, transformPosition } from './transform';

// Utils
export { deepClone } from './utils/clone';
export { deepEqual } from './utils/equal';
export {
  DIFF_DELETE,
  DIFF_EQUAL,
  DIFF_INSERT,
  textDiff,
  type CursorPosition,
  type DiffTuple,
  type DiffType,
} from './utils/text-diff';
