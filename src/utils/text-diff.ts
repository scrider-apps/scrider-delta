/**
 * Character-level text diff algorithm.
 *
 * Adapted from fast-diff (Apache-2.0 License)
 * Copyright (c) 2015 Jason Chen
 * https://github.com/jhchen/fast-diff
 *
 * Which is derived from diff-match-patch (Apache-2.0 License)
 * Copyright (c) 2006 Google Inc.
 * https://github.com/google/diff-match-patch
 *
 * Licensed under the Apache License, Version 2.0.
 * See LICENSES/Apache-2.0.txt for the full license text.
 *
 * Modifications by Pavel Sukharev (2025-2026):
 * - Converted to TypeScript with strict types (DiffType, DiffTuple, CursorPosition)
 * - Removed unused semantic cleanup (diff_cleanupSemantic, diff_cleanupSemanticLossless)
 * - Removed diff_commonOverlap_ (only used in semantic cleanup)
 * - Renamed from snake_case to camelCase
 * - const/let instead of var, === instead of ==
 */

/** Diff operation: text was deleted */
export const DIFF_DELETE = -1 as const;
/** Diff operation: text was inserted */
export const DIFF_INSERT = 1 as const;
/** Diff operation: text is equal */
export const DIFF_EQUAL = 0 as const;

/** Type of a diff operation */
export type DiffType = typeof DIFF_DELETE | typeof DIFF_INSERT | typeof DIFF_EQUAL;

/** A single diff tuple: [type, text] */
export type DiffTuple = [DiffType, string];

/** Cursor position hint for better diff around cursor */
export type CursorPosition =
  | number
  | {
      oldRange: { index: number; length: number };
      newRange?: { index: number; length: number } | null;
    };

// --- Unicode surrogate pair helpers ---

function isSurrogatePairStart(charCode: number): boolean {
  return charCode >= 0xd800 && charCode <= 0xdbff;
}

function isSurrogatePairEnd(charCode: number): boolean {
  return charCode >= 0xdc00 && charCode <= 0xdfff;
}

function startsWithPairEnd(str: string): boolean {
  return isSurrogatePairEnd(str.charCodeAt(0));
}

function endsWithPairStart(str: string): boolean {
  return isSurrogatePairStart(str.charCodeAt(str.length - 1));
}

// --- Common prefix / suffix (binary search) ---

/**
 * Determine the common prefix length of two strings.
 * Uses binary search for performance.
 */
function commonPrefix(text1: string, text2: string): number {
  if (!text1 || !text2 || text1.charAt(0) !== text2.charAt(0)) {
    return 0;
  }
  let pointerMin = 0;
  let pointerMax = Math.min(text1.length, text2.length);
  let pointerMid = pointerMax;
  let pointerStart = 0;
  while (pointerMin < pointerMid) {
    if (text1.substring(pointerStart, pointerMid) === text2.substring(pointerStart, pointerMid)) {
      pointerMin = pointerMid;
      pointerStart = pointerMin;
    } else {
      pointerMax = pointerMid;
    }
    pointerMid = Math.floor((pointerMax - pointerMin) / 2 + pointerMin);
  }
  if (isSurrogatePairStart(text1.charCodeAt(pointerMid - 1))) {
    pointerMid--;
  }
  return pointerMid;
}

/**
 * Determine the common suffix length of two strings.
 * Uses binary search for performance.
 */
function commonSuffix(text1: string, text2: string): number {
  if (!text1 || !text2 || text1.slice(-1) !== text2.slice(-1)) {
    return 0;
  }
  let pointerMin = 0;
  let pointerMax = Math.min(text1.length, text2.length);
  let pointerMid = pointerMax;
  let pointerEnd = 0;
  while (pointerMin < pointerMid) {
    if (
      text1.substring(text1.length - pointerMid, text1.length - pointerEnd) ===
      text2.substring(text2.length - pointerMid, text2.length - pointerEnd)
    ) {
      pointerMin = pointerMid;
      pointerEnd = pointerMin;
    } else {
      pointerMax = pointerMid;
    }
    pointerMid = Math.floor((pointerMax - pointerMin) / 2 + pointerMin);
  }
  if (isSurrogatePairEnd(text1.charCodeAt(text1.length - pointerMid))) {
    pointerMid--;
  }
  return pointerMid;
}

// --- Half-match optimization ---

/**
 * Check if the two texts share a substring which is at least half the length
 * of the longer text. This speedup can produce non-minimal diffs.
 * Returns [text1_prefix, text1_suffix, text2_prefix, text2_suffix, common_middle] or null.
 */
function halfMatch(text1: string, text2: string): [string, string, string, string, string] | null {
  const longtext = text1.length > text2.length ? text1 : text2;
  const shorttext = text1.length > text2.length ? text2 : text1;
  if (longtext.length < 4 || shorttext.length * 2 < longtext.length) {
    return null;
  }

  function halfMatchI(
    lt: string,
    st: string,
    i: number,
  ): [string, string, string, string, string] | null {
    const seed = lt.substring(i, i + Math.floor(lt.length / 4));
    let j = -1;
    let bestCommon = '';
    let bestLtA = '';
    let bestLtB = '';
    let bestStA = '';
    let bestStB = '';
    while ((j = st.indexOf(seed, j + 1)) !== -1) {
      const prefixLen = commonPrefix(lt.substring(i), st.substring(j));
      const suffixLen = commonSuffix(lt.substring(0, i), st.substring(0, j));
      if (bestCommon.length < suffixLen + prefixLen) {
        bestCommon = st.substring(j - suffixLen, j) + st.substring(j, j + prefixLen);
        bestLtA = lt.substring(0, i - suffixLen);
        bestLtB = lt.substring(i + prefixLen);
        bestStA = st.substring(0, j - suffixLen);
        bestStB = st.substring(j + prefixLen);
      }
    }
    if (bestCommon.length * 2 >= lt.length) {
      return [bestLtA, bestLtB, bestStA, bestStB, bestCommon];
    }
    return null;
  }

  const hm1 = halfMatchI(longtext, shorttext, Math.ceil(longtext.length / 4));
  const hm2 = halfMatchI(longtext, shorttext, Math.ceil(longtext.length / 2));
  let hm: [string, string, string, string, string];
  if (!hm1 && !hm2) {
    return null;
  } else if (!hm2) {
    hm = hm1!;
  } else if (!hm1) {
    hm = hm2;
  } else {
    hm = hm1[4].length > hm2[4].length ? hm1 : hm2;
  }

  let text1A: string, text1B: string, text2A: string, text2B: string;
  if (text1.length > text2.length) {
    text1A = hm[0];
    text1B = hm[1];
    text2A = hm[2];
    text2B = hm[3];
  } else {
    text2A = hm[0];
    text2B = hm[1];
    text1A = hm[2];
    text1B = hm[3];
  }
  return [text1A, text1B, text2A, text2B, hm[4]];
}

// --- Myers' bisect algorithm ---

/**
 * Find the 'middle snake' of a diff, split the problem in two
 * and return the recursively constructed diff.
 * See Myers 1986 paper: An O(ND) Difference Algorithm and Its Variations.
 */
function bisect(text1: string, text2: string): DiffTuple[] {
  const text1Length = text1.length;
  const text2Length = text2.length;
  const maxD = Math.ceil((text1Length + text2Length) / 2);
  const vOffset = maxD;
  const vLength = 2 * maxD;
  const v1 = new Array<number>(vLength).fill(-1);
  const v2 = new Array<number>(vLength).fill(-1);
  v1[vOffset + 1] = 0;
  v2[vOffset + 1] = 0;
  const delta = text1Length - text2Length;
  const front = delta % 2 !== 0;
  let k1start = 0;
  let k1end = 0;
  let k2start = 0;
  let k2end = 0;

  for (let d = 0; d < maxD; d++) {
    // Walk the front path one step
    for (let k1 = -d + k1start; k1 <= d - k1end; k1 += 2) {
      const k1Offset = vOffset + k1;
      let x1: number;
      if (k1 === -d || (k1 !== d && v1[k1Offset - 1]! < v1[k1Offset + 1]!)) {
        x1 = v1[k1Offset + 1]!;
      } else {
        x1 = v1[k1Offset - 1]! + 1;
      }
      let y1 = x1 - k1;
      while (x1 < text1Length && y1 < text2Length && text1.charAt(x1) === text2.charAt(y1)) {
        x1++;
        y1++;
      }
      v1[k1Offset] = x1;
      if (x1 > text1Length) {
        k1end += 2;
      } else if (y1 > text2Length) {
        k1start += 2;
      } else if (front) {
        const k2Offset = vOffset + delta - k1;
        if (k2Offset >= 0 && k2Offset < vLength && v2[k2Offset]! !== -1) {
          const x2 = text1Length - v2[k2Offset]!;
          if (x1 >= x2) {
            return bisectSplit(text1, text2, x1, y1);
          }
        }
      }
    }

    // Walk the reverse path one step
    for (let k2 = -d + k2start; k2 <= d - k2end; k2 += 2) {
      const k2Offset = vOffset + k2;
      let x2: number;
      if (k2 === -d || (k2 !== d && v2[k2Offset - 1]! < v2[k2Offset + 1]!)) {
        x2 = v2[k2Offset + 1]!;
      } else {
        x2 = v2[k2Offset - 1]! + 1;
      }
      let y2 = x2 - k2;
      while (
        x2 < text1Length &&
        y2 < text2Length &&
        text1.charAt(text1Length - x2 - 1) === text2.charAt(text2Length - y2 - 1)
      ) {
        x2++;
        y2++;
      }
      v2[k2Offset] = x2;
      if (x2 > text1Length) {
        k2end += 2;
      } else if (y2 > text2Length) {
        k2start += 2;
      } else if (!front) {
        const k1Offset = vOffset + delta - k2;
        if (k1Offset >= 0 && k1Offset < vLength && v1[k1Offset]! !== -1) {
          const x1 = v1[k1Offset]!;
          const y1 = vOffset + x1 - k1Offset;
          const x2m = text1Length - x2;
          if (x1 >= x2m) {
            return bisectSplit(text1, text2, x1, y1);
          }
        }
      }
    }
  }

  // No commonality at all
  return [
    [DIFF_DELETE, text1],
    [DIFF_INSERT, text2],
  ];
}

/**
 * Given the location of the 'middle snake', split the diff in two parts and recurse.
 */
function bisectSplit(text1: string, text2: string, x: number, y: number): DiffTuple[] {
  const text1a = text1.substring(0, x);
  const text2a = text2.substring(0, y);
  const text1b = text1.substring(x);
  const text2b = text2.substring(y);
  const diffsA = diffMain(text1a, text2a);
  const diffsB = diffMain(text1b, text2b);
  return diffsA.concat(diffsB);
}

// --- Compute (dispatcher with speedups) ---

/**
 * Find the differences between two texts.
 * Assumes that the texts do not have any common prefix or suffix.
 */
function diffCompute(text1: string, text2: string): DiffTuple[] {
  if (!text1) {
    return [[DIFF_INSERT, text2]];
  }
  if (!text2) {
    return [[DIFF_DELETE, text1]];
  }

  const longtext = text1.length > text2.length ? text1 : text2;
  const shorttext = text1.length > text2.length ? text2 : text1;
  const i = longtext.indexOf(shorttext);
  if (i !== -1) {
    const diffs: DiffTuple[] = [
      [DIFF_INSERT, longtext.substring(0, i)],
      [DIFF_EQUAL, shorttext],
      [DIFF_INSERT, longtext.substring(i + shorttext.length)],
    ];
    if (text1.length > text2.length) {
      diffs[0]![0] = diffs[2]![0] = DIFF_DELETE;
    }
    return diffs;
  }

  if (shorttext.length === 1) {
    return [
      [DIFF_DELETE, text1],
      [DIFF_INSERT, text2],
    ];
  }

  const hm = halfMatch(text1, text2);
  if (hm) {
    const diffsA = diffMain(hm[0], hm[2]);
    const diffsB = diffMain(hm[1], hm[3]);
    return diffsA.concat([[DIFF_EQUAL, hm[4]]], diffsB);
  }

  return bisect(text1, text2);
}

// --- Cleanup merge ---

/**
 * Reorder and merge like edit sections. Merge equalities.
 * Any edit section can move as long as it doesn't cross an equality.
 *
 * Mutates the diffs array in place.
 */
function cleanupMerge(diffs: DiffTuple[], fixUnicode: boolean): void {
  diffs.push([DIFF_EQUAL, '']);
  let pointer = 0;
  let countDelete = 0;
  let countInsert = 0;
  let textDelete = '';
  let textInsert = '';

  while (pointer < diffs.length) {
    if (pointer < diffs.length - 1 && !diffs[pointer]![1]) {
      diffs.splice(pointer, 1);
      continue;
    }
    switch (diffs[pointer]![0]) {
      case DIFF_INSERT:
        countInsert++;
        textInsert += diffs[pointer]![1];
        pointer++;
        break;
      case DIFF_DELETE:
        countDelete++;
        textDelete += diffs[pointer]![1];
        pointer++;
        break;
      case DIFF_EQUAL: {
        let previousEquality = pointer - countInsert - countDelete - 1;
        if (fixUnicode) {
          if (previousEquality >= 0 && endsWithPairStart(diffs[previousEquality]![1])) {
            const stray = diffs[previousEquality]![1].slice(-1);
            diffs[previousEquality]![1] = diffs[previousEquality]![1].slice(0, -1);
            textDelete = stray + textDelete;
            textInsert = stray + textInsert;
            if (!diffs[previousEquality]![1]) {
              diffs.splice(previousEquality, 1);
              pointer--;
              let k = previousEquality - 1;
              if (diffs[k] && diffs[k]![0] === DIFF_INSERT) {
                countInsert++;
                textInsert = diffs[k]![1] + textInsert;
                k--;
              }
              if (diffs[k] && diffs[k]![0] === DIFF_DELETE) {
                countDelete++;
                textDelete = diffs[k]![1] + textDelete;
                k--;
              }
              previousEquality = k;
            }
          }
          if (startsWithPairEnd(diffs[pointer]![1])) {
            const stray = diffs[pointer]![1].charAt(0);
            diffs[pointer]![1] = diffs[pointer]![1].slice(1);
            textDelete += stray;
            textInsert += stray;
          }
        }
        if (pointer < diffs.length - 1 && !diffs[pointer]![1]) {
          diffs.splice(pointer, 1);
          break;
        }
        if (textDelete.length > 0 || textInsert.length > 0) {
          if (textDelete.length > 0 && textInsert.length > 0) {
            let cl = commonPrefix(textInsert, textDelete);
            if (cl !== 0) {
              if (previousEquality >= 0) {
                diffs[previousEquality]![1] += textInsert.substring(0, cl);
              } else {
                diffs.splice(0, 0, [DIFF_EQUAL, textInsert.substring(0, cl)]);
                pointer++;
              }
              textInsert = textInsert.substring(cl);
              textDelete = textDelete.substring(cl);
            }
            cl = commonSuffix(textInsert, textDelete);
            if (cl !== 0) {
              diffs[pointer]![1] =
                textInsert.substring(textInsert.length - cl) + diffs[pointer]![1];
              textInsert = textInsert.substring(0, textInsert.length - cl);
              textDelete = textDelete.substring(0, textDelete.length - cl);
            }
          }
          const n = countInsert + countDelete;
          if (textDelete.length === 0 && textInsert.length === 0) {
            diffs.splice(pointer - n, n);
            pointer = pointer - n;
          } else if (textDelete.length === 0) {
            diffs.splice(pointer - n, n, [DIFF_INSERT, textInsert]);
            pointer = pointer - n + 1;
          } else if (textInsert.length === 0) {
            diffs.splice(pointer - n, n, [DIFF_DELETE, textDelete]);
            pointer = pointer - n + 1;
          } else {
            diffs.splice(pointer - n, n, [DIFF_DELETE, textDelete], [DIFF_INSERT, textInsert]);
            pointer = pointer - n + 2;
          }
        }
        if (pointer !== 0 && diffs[pointer - 1]![0] === DIFF_EQUAL) {
          diffs[pointer - 1]![1] += diffs[pointer]![1];
          diffs.splice(pointer, 1);
        } else {
          pointer++;
        }
        countInsert = 0;
        countDelete = 0;
        textDelete = '';
        textInsert = '';
        break;
      }
    }
  }
  if (diffs[diffs.length - 1]![1] === '') {
    diffs.pop();
  }

  // Second pass: shift edits sideways to eliminate equalities
  let changes = false;
  pointer = 1;
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1]![0] === DIFF_EQUAL && diffs[pointer + 1]![0] === DIFF_EQUAL) {
      if (
        diffs[pointer]![1].substring(diffs[pointer]![1].length - diffs[pointer - 1]![1].length) ===
        diffs[pointer - 1]![1]
      ) {
        diffs[pointer]![1] =
          diffs[pointer - 1]![1] +
          diffs[pointer]![1].substring(
            0,
            diffs[pointer]![1].length - diffs[pointer - 1]![1].length,
          );
        diffs[pointer + 1]![1] = diffs[pointer - 1]![1] + diffs[pointer + 1]![1];
        diffs.splice(pointer - 1, 1);
        changes = true;
      } else if (
        diffs[pointer]![1].substring(0, diffs[pointer + 1]![1].length) === diffs[pointer + 1]![1]
      ) {
        diffs[pointer - 1]![1] += diffs[pointer + 1]![1];
        diffs[pointer]![1] =
          diffs[pointer]![1].substring(diffs[pointer + 1]![1].length) + diffs[pointer + 1]![1];
        diffs.splice(pointer + 1, 1);
        changes = true;
      }
    }
    pointer++;
  }
  if (changes) {
    cleanupMerge(diffs, fixUnicode);
  }
}

// --- Cursor-aware edit diff ---

function removeEmptyTuples(tuples: DiffTuple[]): DiffTuple[] {
  const ret: DiffTuple[] = [];
  for (let i = 0; i < tuples.length; i++) {
    if (tuples[i]![1].length > 0) {
      ret.push(tuples[i]!);
    }
  }
  return ret;
}

function makeEditSplice(
  before: string,
  oldMiddle: string,
  newMiddle: string,
  after: string,
): DiffTuple[] | null {
  if (endsWithPairStart(before) || startsWithPairEnd(after)) {
    return null;
  }
  return removeEmptyTuples([
    [DIFF_EQUAL, before],
    [DIFF_DELETE, oldMiddle],
    [DIFF_INSERT, newMiddle],
    [DIFF_EQUAL, after],
  ]);
}

function findCursorEditDiff(
  oldText: string,
  newText: string,
  cursorPos: CursorPosition,
): DiffTuple[] | null {
  const oldRange =
    typeof cursorPos === 'number' ? { index: cursorPos, length: 0 } : cursorPos.oldRange;
  const newRange = typeof cursorPos === 'number' ? null : (cursorPos.newRange ?? null);

  const oldLength = oldText.length;
  const newLength = newText.length;

  if (oldRange.length === 0 && (newRange === null || newRange.length === 0)) {
    const oldCursor = oldRange.index;
    const oldBefore = oldText.slice(0, oldCursor);
    const oldAfter = oldText.slice(oldCursor);
    const maybeNewCursor = newRange ? newRange.index : null;

    // Check: insert or delete right before oldCursor?
    editBefore: {
      const newCursor = oldCursor + newLength - oldLength;
      if (maybeNewCursor !== null && maybeNewCursor !== newCursor) {
        break editBefore;
      }
      if (newCursor < 0 || newCursor > newLength) {
        break editBefore;
      }
      const newBefore = newText.slice(0, newCursor);
      const newAfter = newText.slice(newCursor);
      if (newAfter !== oldAfter) {
        break editBefore;
      }
      const prefixLen = Math.min(oldCursor, newCursor);
      const oldPrefix = oldBefore.slice(0, prefixLen);
      const newPrefix = newBefore.slice(0, prefixLen);
      if (oldPrefix !== newPrefix) {
        break editBefore;
      }
      const oldMiddle = oldBefore.slice(prefixLen);
      const newMiddle = newBefore.slice(prefixLen);
      return makeEditSplice(oldPrefix, oldMiddle, newMiddle, oldAfter);
    }

    // Check: insert or delete right after oldCursor?
    editAfter: {
      if (maybeNewCursor !== null && maybeNewCursor !== oldCursor) {
        break editAfter;
      }
      const cursor = oldCursor;
      const newBefore = newText.slice(0, cursor);
      const newAfter = newText.slice(cursor);
      if (newBefore !== oldBefore) {
        break editAfter;
      }
      const suffixLen = Math.min(oldLength - cursor, newLength - cursor);
      const oldSuffix = oldAfter.slice(oldAfter.length - suffixLen);
      const newSuffix = newAfter.slice(newAfter.length - suffixLen);
      if (oldSuffix !== newSuffix) {
        break editAfter;
      }
      const oldMiddle = oldAfter.slice(0, oldAfter.length - suffixLen);
      const newMiddle = newAfter.slice(0, newAfter.length - suffixLen);
      return makeEditSplice(oldBefore, oldMiddle, newMiddle, oldSuffix);
    }
  }

  if (oldRange.length > 0 && newRange && newRange.length === 0) {
    // Check: splice of the old selection range?
    replaceRange: {
      const oldPrefix = oldText.slice(0, oldRange.index);
      const oldSuffix = oldText.slice(oldRange.index + oldRange.length);
      const prefixLen = oldPrefix.length;
      const suffixLen = oldSuffix.length;
      if (newLength < prefixLen + suffixLen) {
        break replaceRange;
      }
      const newPrefix = newText.slice(0, prefixLen);
      const newSuffix = newText.slice(newLength - suffixLen);
      if (oldPrefix !== newPrefix || oldSuffix !== newSuffix) {
        break replaceRange;
      }
      const oldMiddle = oldText.slice(prefixLen, oldLength - suffixLen);
      const newMiddle = newText.slice(prefixLen, newLength - suffixLen);
      return makeEditSplice(oldPrefix, oldMiddle, newMiddle, oldSuffix);
    }
  }

  return null;
}

// --- Main entry points ---

/**
 * Internal diff_main — can be called recursively (without fixUnicode).
 */
function diffMain(
  text1: string,
  text2: string,
  cursorPos?: CursorPosition,
  fixUnicode?: boolean,
): DiffTuple[] {
  // Check for equality
  if (text1 === text2) {
    if (text1) {
      return [[DIFF_EQUAL, text1]];
    }
    return [];
  }

  // Cursor-aware optimization
  if (cursorPos != null) {
    const editdiff = findCursorEditDiff(text1, text2, cursorPos);
    if (editdiff) {
      return editdiff;
    }
  }

  // Trim off common prefix (speedup)
  let cl = commonPrefix(text1, text2);
  const prefix = text1.substring(0, cl);
  text1 = text1.substring(cl);
  text2 = text2.substring(cl);

  // Trim off common suffix (speedup)
  cl = commonSuffix(text1, text2);
  const suffix = text1.substring(text1.length - cl);
  text1 = text1.substring(0, text1.length - cl);
  text2 = text2.substring(0, text2.length - cl);

  // Compute the diff on the middle block
  const diffs = diffCompute(text1, text2);

  // Restore the prefix and suffix
  if (prefix) {
    diffs.unshift([DIFF_EQUAL, prefix]);
  }
  if (suffix) {
    diffs.push([DIFF_EQUAL, suffix]);
  }

  cleanupMerge(diffs, !!fixUnicode);

  return diffs;
}

/**
 * Compute character-level diff between two strings.
 *
 * Based on Myers' O(ND) algorithm with optimizations:
 * - Common prefix/suffix trimming (binary search)
 * - Half-match optimization for large texts
 * - Cursor-aware diff for editor integration
 * - Unicode surrogate pair safety
 *
 * @param oldText - Original text
 * @param newText - New text
 * @param cursorPos - Optional cursor position hint for better diff around edits
 * @returns Array of diff tuples: [type, text] where type is DIFF_DELETE (-1), DIFF_INSERT (1), or DIFF_EQUAL (0)
 *
 * @example
 * ```typescript
 * import { textDiff, DIFF_DELETE, DIFF_INSERT, DIFF_EQUAL } from '@scrider/delta';
 *
 * const diffs = textDiff('Hello world', 'Hello there');
 * // [
 * //   [DIFF_EQUAL, 'Hello '],
 * //   [DIFF_DELETE, 'world'],
 * //   [DIFF_INSERT, 'there'],
 * // ]
 * ```
 */
export function textDiff(
  oldText: string,
  newText: string,
  cursorPos?: CursorPosition,
): DiffTuple[] {
  // fixUnicode=true only at the top level, not when recursively invoked
  return diffMain(oldText, newText, cursorPos, true);
}
