// Deterministic document serialization for the NoKV journal workbench
// (design §3). Block-level edits rely on byte-exact extraction: a top-level
// block always starts with `\n  "<key>":` and that byte pattern cannot occur
// inside JSON string values (real newlines are escaped there), so
// workbench_edit's exact-string matching is unambiguous.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Serializes a document root: 2-space indent, insertion key order,
 *  no trailing whitespace. Build docs with keys in canonical order. */
export function serializeDoc(doc: Record<string, JsonValue>): string {
  return JSON.stringify(doc, null, 2);
}

/** Renders the byte-exact top-level block for `key` as it appears inside a
 *  serializeDoc output (leading newline + 2-space indent, no trailing comma). */
export function buildBlock(key: string, value: JsonValue): string {
  const single = JSON.stringify({ [key]: value }, null, 2);
  // `{` + block + `\n}` -> strip the wrapper.
  return single.slice(1, single.length - 2);
}

/** Extracts the byte-exact top-level block for `key` from a serialized doc.
 *  Returns null when the key is absent. */
export function extractBlock(text: string, key: string): string | null {
  const marker = `\n  ${JSON.stringify(key)}:`;
  const start = text.indexOf(marker);
  if (start === -1) return null;

  let i = start + marker.length;
  // Skip the single space after the colon.
  while (text[i] === ' ') i++;

  const end = scanValueEnd(text, i);
  if (end === -1) return null;
  return text.slice(start, end);
}

/** Returns the index one past the end of the JSON value starting at `i`. */
function scanValueEnd(text: string, i: number): number {
  const first = text[i];
  if (first === '{' || first === '[') {
    const open = first;
    const close = first === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inString) {
        if (c === '\\') j++;
        else if (c === '"') inString = false;
        continue;
      }
      if (c === '"') inString = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return j + 1;
      }
    }
    return -1;
  }
  if (first === '"') {
    for (let j = i + 1; j < text.length; j++) {
      if (text[j] === '\\') j++;
      else if (text[j] === '"') return j + 1;
    }
    return -1;
  }
  // null / number / boolean: ends at comma or newline.
  for (let j = i; j < text.length; j++) {
    if (text[j] === ',' || text[j] === '\n') return j;
  }
  return text.length;
}

/** Parses a serialized doc; throws on malformed content. */
export function parseDoc<T = Record<string, JsonValue>>(text: string): T {
  return JSON.parse(text) as T;
}
