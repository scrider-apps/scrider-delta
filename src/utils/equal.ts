/**
 * Deep equality comparison for two values
 * Handles primitives, arrays, objects, null, undefined
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  // Same reference or both primitives with same value
  if (a === b) {
    return true;
  }

  // Handle null/undefined
  if (a === null || b === null || a === undefined || b === undefined) {
    return false;
  }

  // Different types
  if (typeof a !== typeof b) {
    return false;
  }

  // Arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  // One is array, other is not
  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  // Objects
  if (typeof a === 'object' && typeof b === 'object') {
    const objA = a as Record<string, unknown>;
    const objB = b as Record<string, unknown>;
    const keysA = Object.keys(objA);
    const keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) {
      return false;
    }

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(objB, key)) {
        return false;
      }
      if (!deepEqual(objA[key], objB[key])) {
        return false;
      }
    }
    return true;
  }

  // Primitives that are not equal (caught by a === b above)
  return false;
}
