/**
 * Attribute map for formatting operations
 * Keys are format names, values are format values
 * null value means "remove this attribute"
 */
export type AttributeMap = Record<string, unknown>;

/**
 * Value for insert operation: text string or embed object
 */
export type InsertValue = string | Record<string, unknown>;

/**
 * Insert operation - inserts text or embed
 */
export interface InsertOp {
  insert: InsertValue;
  attributes?: AttributeMap;
}

/**
 * Retain operation - keeps characters, optionally with formatting changes
 */
export interface RetainOp {
  retain: number;
  attributes?: AttributeMap;
}

/**
 * Delete operation - removes characters
 */
export interface DeleteOp {
  delete: number;
}

/**
 * Delta operation - one of insert, retain, or delete
 */
export type Op = InsertOp | RetainOp | DeleteOp;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if operation is an insert
 */
export function isInsert(op: Op): op is InsertOp {
  return 'insert' in op;
}

/**
 * Check if operation is a retain
 */
export function isRetain(op: Op): op is RetainOp {
  return 'retain' in op;
}

/**
 * Check if operation is a delete
 */
export function isDelete(op: Op): op is DeleteOp {
  return 'delete' in op;
}

/**
 * Check if operation is a text insert (not embed)
 */
export function isTextInsert(op: Op): op is InsertOp & { insert: string } {
  return isInsert(op) && typeof op.insert === 'string';
}

/**
 * Check if operation is an embed insert (not text)
 */
export function isEmbedInsert(op: Op): op is InsertOp & { insert: Record<string, unknown> } {
  return isInsert(op) && typeof op.insert === 'object' && op.insert !== null;
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Get the length of an operation
 * - Insert: string length or 1 for embeds
 * - Retain: retain count
 * - Delete: delete count
 */
export function opLength(op: Op): number {
  if (isInsert(op)) {
    return typeof op.insert === 'string' ? op.insert.length : 1;
  }
  if (isRetain(op)) {
    return op.retain;
  }
  if (isDelete(op)) {
    return op.delete;
  }
  return 0;
}

/**
 * Get the type of an operation
 */
export function opType(op: Op): 'insert' | 'retain' | 'delete' {
  if (isInsert(op)) return 'insert';
  if (isRetain(op)) return 'retain';
  return 'delete';
}
