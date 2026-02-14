/**
 * Deep clone a value
 * Handles primitives, arrays, objects, null, undefined
 */
export function deepClone<T>(value: T): T {
  // Primitives and null
  if (value === null || typeof value !== 'object') {
    return value;
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item: unknown) => deepClone(item)) as T;
  }

  // Objects
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    result[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return result as T;
}
