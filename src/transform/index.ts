/**
 * Transform operations for OT (Operational Transform)
 *
 * These functions implement the core OT operations needed for:
 * - Collaborative editing (compose, transform)
 * - Undo/redo (invert)
 * - Change tracking (diff)
 */

export { compose } from './compose';
export { diff } from './diff';
export { invert } from './invert';
export { transform, transformPosition } from './transform';
