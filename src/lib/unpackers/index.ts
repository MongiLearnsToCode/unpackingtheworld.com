import { base64 } from "./base64.ts";
import { htmlEntities } from "./htmlEntities.ts";
import { jwt } from "./jwt.ts";
import { suggestNext } from "./nested.ts";
import { pem } from "./pem.ts";
import { timestamp } from "./timestamp.ts";
import type { Unpacked, Unpacker } from "./types.ts";
import { url } from "./url.ts";
import { uuid } from "./uuid.ts";
import { x509 } from "./x509.ts";

export * from "./types.ts";

export const unpackers: Unpacker[] = [jwt, url, base64, pem, x509, htmlEntities, timestamp, uuid];

export interface Detection {
  unpacker: Unpacker;
  score: number;
}

/** Every unpacker that thinks it can handle the input, best first. */
export function detect(input: string): Detection[] {
  if (!input.trim()) return [];
  return unpackers
    .map((unpacker) => ({ unpacker, score: unpacker.score(input) }))
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score);
}

export function unpack(id: string, input: string, depth = 0): Unpacked | null {
  const result = unpackers.find((u) => u.id === id)?.unpack(input) ?? null;
  if (result) result.next = suggestNext(result, input, detect, depth);
  return result;
}
