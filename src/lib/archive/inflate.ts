import { Gunzip, Inflate } from "fflate";
import { ENTRY_TOO_LARGE_MESSAGE, EXPANDS_TOO_MUCH_MESSAGE } from "./limits.ts";

const STEP = 256 * 1024;

function concat(chunks: Uint8Array[], total: number): Uint8Array {
  if (chunks.length === 1) return chunks[0];
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Feed the input to a streaming decoder in bounded steps and abort as soon as
 * the output budget is exceeded. `fflate`'s `*Sync` helpers have no output
 * budget, which is exactly the hole a zip or gzip bomb walks through.
 */
function drain(input: Uint8Array, push: (chunk: Uint8Array, final: boolean) => void): void {
  for (let offset = 0; offset < input.length; offset += STEP) {
    const end = Math.min(offset + STEP, input.length);
    push(input.subarray(offset, end), end === input.length);
  }
}

export function gunzipCapped(input: Uint8Array, limit: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const gunzip = new Gunzip((chunk) => {
    total += chunk.length;
    if (total > limit) throw new Error(EXPANDS_TOO_MUCH_MESSAGE);
    chunks.push(chunk);
  });
  drain(input, (chunk, final) => gunzip.push(chunk, final));
  return concat(chunks, total);
}

export function inflateCapped(input: Uint8Array, limit: number): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const inflate = new Inflate((chunk) => {
    total += chunk.length;
    if (total > limit) throw new Error(ENTRY_TOO_LARGE_MESSAGE);
    chunks.push(chunk);
  });
  drain(input, (chunk, final) => inflate.push(chunk, final));
  return concat(chunks, total);
}
