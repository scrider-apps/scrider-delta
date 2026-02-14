import { deepClone } from '../utils/clone';
import { deepEqual } from '../utils/equal';
import type { AttributeMap } from './Op';

/**
 * Compose two attribute maps
 * b overwrites a, null values remove keys
 * Returns undefined if result is empty
 */
export function compose(
  a: AttributeMap | undefined,
  b: AttributeMap | undefined,
): AttributeMap | undefined {
  // If b is undefined, return a (or undefined if a is also undefined)
  if (b === undefined) {
    return a ? deepClone(a) : undefined;
  }

  // If a is undefined, filter out null values from b
  if (a === undefined) {
    const result: AttributeMap = {};
    for (const key of Object.keys(b)) {
      if (b[key] !== null) {
        result[key] = deepClone(b[key]);
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  // Merge a and b
  const result: AttributeMap = deepClone(a);
  for (const key of Object.keys(b)) {
    if (b[key] === null) {
      delete result[key];
    } else {
      result[key] = deepClone(b[key]);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Get the difference between two attribute maps
 * Returns the changes needed to transform a into b
 * null values indicate key removal
 */
export function diff(
  a: AttributeMap | undefined,
  b: AttributeMap | undefined,
): AttributeMap | undefined {
  // If both undefined, no diff
  if (a === undefined && b === undefined) {
    return undefined;
  }

  // If a is undefined, b is the diff (add all keys)
  if (a === undefined) {
    return b ? deepClone(b) : undefined;
  }

  // If b is undefined, remove all keys from a
  if (b === undefined) {
    const result: AttributeMap = {};
    for (const key of Object.keys(a)) {
      result[key] = null;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  // Both defined, compare
  const result: AttributeMap = {};

  // Keys in a but not in b (removed) or with different values
  for (const key of Object.keys(a)) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) {
      result[key] = null;
    } else if (!deepEqual(a[key], b[key])) {
      result[key] = deepClone(b[key]);
    }
  }

  // Keys in b but not in a (added)
  for (const key of Object.keys(b)) {
    if (!Object.prototype.hasOwnProperty.call(a, key)) {
      result[key] = deepClone(b[key]);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Invert attribute changes
 * Returns the changes needed to undo applying attr to base
 */
export function invert(
  attr: AttributeMap | undefined,
  base: AttributeMap | undefined,
): AttributeMap {
  const result: AttributeMap = {};

  if (attr === undefined) {
    return result;
  }

  for (const key of Object.keys(attr)) {
    if (attr[key] === null) {
      // Attribute was removed, restore from base if it existed
      if (base && Object.prototype.hasOwnProperty.call(base, key)) {
        result[key] = deepClone(base[key]);
      }
    } else {
      // Attribute was added or changed
      if (base && Object.prototype.hasOwnProperty.call(base, key)) {
        // Restore original value if different
        if (!deepEqual(attr[key], base[key])) {
          result[key] = deepClone(base[key]);
        }
      } else {
        // Remove the added attribute
        result[key] = null;
      }
    }
  }

  return result;
}

/**
 * Transform attribute map for OT
 * Given that a has been applied, transform b
 * If priority is true, b takes precedence on conflicts
 */
export function transform(
  a: AttributeMap | undefined,
  b: AttributeMap | undefined,
  priority: boolean,
): AttributeMap | undefined {
  // If a is undefined, b doesn't need transformation
  if (a === undefined) {
    return b ? deepClone(b) : undefined;
  }

  // If b is undefined, nothing to transform
  if (b === undefined) {
    return undefined;
  }

  // If priority is true, b wins on conflicts - return b unchanged
  if (priority) {
    return deepClone(b);
  }

  // Priority is false, a wins - filter out conflicting keys from b
  const result: AttributeMap = {};
  for (const key of Object.keys(b)) {
    if (!Object.prototype.hasOwnProperty.call(a, key)) {
      result[key] = deepClone(b[key]);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}
