import { base64 } from "./base64.ts";
import { jwt } from "./jwt.ts";
import { pem } from "./pem.ts";
import type { Unpacked, Unpacker } from "./types.ts";
import { url } from "./url.ts";

export * from "./types.ts";

export const unpackers: Unpacker[] = [jwt, url, base64, pem];

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

export function unpack(id: string, input: string): Unpacked | null {
  return unpackers.find((u) => u.id === id)?.unpack(input) ?? null;
}
