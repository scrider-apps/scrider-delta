# @scrider/delta

JSON format for describing rich-text content and changes. Core Delta class and OT (Operational Transformation) operations.

## Overview

`@scrider/delta` is the data layer of the [Scrider](https://github.com/scrider-apps) ecosystem. It provides a compact, JSON-serializable format for representing rich-text documents and the changes made to them. Strict TypeScript, zero runtime dependencies.

## Key Features

- **Delta class** — chainable builder for rich-text documents and changes
- **OT operations** — `compose`, `transform`, `diff`, `invert` for collaborative editing and undo/redo
- **Zero dependencies** — no runtime or peer dependencies
- **Dual format** — ESM + CJS builds
- **Strict TypeScript** — discriminated union types, type guards, full type safety
- **Lightweight** — ~44 KB total bundle

## Installation

```bash
npm install @scrider/delta
# or
pnpm add @scrider/delta
```

## Quick Start

```typescript
import { Delta } from '@scrider/delta';

// Create a document
const doc = new Delta()
  .insert('Hello', { bold: true })
  .insert(' world')
  .insert('\n');

// Create a change
const change = new Delta()
  .retain(5)
  .delete(6)
  .insert(' Scrider');

// Apply the change
import { compose } from '@scrider/delta';
const result = compose(doc, change);
// → "Hello Scrider\n" (with bold on "Hello")
```

## API

### Delta Class

```typescript
new Delta(ops?)          // Create from ops array, Delta, or { ops: [...] }
  .insert(text, attrs?)  // Insert text or embed with optional attributes
  .retain(length, attrs?) // Retain (keep) characters, optionally changing attributes
  .delete(length)        // Delete characters
  .push(op)              // Push a raw operation (with compaction)
  .chop()                // Remove trailing retain ops
  .length()              // Total document length
  .slice(start?, end?)   // Slice operations by character index
  .eachLine(cb)          // Iterate over lines
  .concat(other)         // Concatenate two Deltas
  .filter(fn)            // Filter operations
  .map(fn)               // Map operations
  .forEach(fn)           // Iterate operations
  .reduce(fn, init)      // Reduce operations
  .changeLength()        // Net length change (for change Deltas)
```

### OT Operations

```typescript
import { compose, transform, diff, invert, transformPosition } from '@scrider/delta';

compose(a, b)              // Apply b after a → merged Delta
transform(a, b, priority)  // Transform b against a → new b'
diff(a, b)                 // Compute change from a to b
invert(change, base)       // Invert a change (for undo)
transformPosition(a, index) // Transform a cursor position
```

### Type Guards

```typescript
import { isInsert, isRetain, isDelete, isTextInsert, isEmbedInsert, opLength, opType } from '@scrider/delta';
```

### Text Diff

```typescript
import { textDiff, DIFF_INSERT, DIFF_DELETE, DIFF_EQUAL } from '@scrider/delta';

const diffs = textDiff('Hello world', 'Hello there');
// [[DIFF_EQUAL, 'Hello '], [DIFF_DELETE, 'world'], [DIFF_INSERT, 'there']]
```

## Ecosystem

```
@scrider/delta          ← you are here (Core — 0 deps)
    ↑
@scrider/formatting     Schema + Conversion (HTML, Markdown)
    ↑
@scrider/editor         React WYSIWYG Component (planned)
```

## License

[MIT](./LICENSE)

This package includes adapted code from [fast-diff](https://github.com/jhchen/fast-diff) (Apache-2.0). See [NOTICE](./NOTICE) for details.
