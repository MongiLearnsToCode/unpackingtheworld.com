import {
  ENTRY_TOO_LARGE_MESSAGE,
  EXPANDS_TOO_MUCH_MESSAGE,
  MAX_ARCHIVE_ENTRIES,
  MAX_UNPACKED_ENTRY_BYTES,
  MAX_UNPACKED_TOTAL_BYTES,
  TOO_MANY_ENTRIES_MESSAGE,
} from "./limits.ts";
import { gunzipCapped } from "./inflate.ts";
import type { ArchiveSource } from "./source.ts";
import type { ArchiveEntry } from "./zip.ts";

export async function isGzip(source: ArchiveSource): Promise<boolean> {
  const head = new Uint8Array(await source.slice(0, 2).arrayBuffer());
  return head.length === 2 && head[0] === 0x1f && head[1] === 0x8b;
}

export async function isTar(source: ArchiveSource): Promise<boolean> {
  const head = new Uint8Array(await source.slice(0, 512).arrayBuffer());
  if (head.length < 512) return false;
  const magic = new TextDecoder().decode(head.subarray(257, 262));
  return magic === "ustar";
}

function readString(bytes: Uint8Array, start: number, length: number): string {
  let end = start;
  while (end < start + length && bytes[end] !== 0) end++;
  return new TextDecoder().decode(bytes.subarray(start, end));
}

function octal(value: string): number {
  const parsed = Number.parseInt(value.replace(/[^0-7]/g, ""), 8);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rounded(size: number): number {
  return Math.ceil(size / 512) * 512;
}

export async function readTar(source: ArchiveSource): Promise<ArchiveEntry[]> {
  let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await source.arrayBuffer());
  if (await isGzip(source)) bytes = gunzipCapped(bytes, MAX_UNPACKED_TOTAL_BYTES);

  const entries: ArchiveEntry[] = [];
  let totalSize = 0;
  let offset = 0;
  let longName = "";

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = octal(readString(header, 124, 12));
    const type = String.fromCharCode(header[156]);
    const name = readString(header, 0, 100);
    const prefix = readString(header, 345, 155);
    const path = prefix ? `${prefix}/${name}` : name;
    const payload = bytes.subarray(offset + 512, offset + 512 + size);
    if (size > MAX_UNPACKED_ENTRY_BYTES) throw new Error(ENTRY_TOO_LARGE_MESSAGE);

    if (type === "L") {
      longName = new TextDecoder().decode(payload).replace(/\0+$/, "");
    } else if (!["x", "g", "K"].includes(type) && path) {
      const finalPath = longName || path;
      const dataStart = offset + 512;
      longName = "";
      entries.push({
        path: finalPath,
        size,
        compressedSize: size,
        directory: type === "5" || finalPath.endsWith("/"),
        async read() {
          return type === "5" ? null : bytes.subarray(dataStart, dataStart + size);
        },
      });
      totalSize += size;
      if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error(TOO_MANY_ENTRIES_MESSAGE);
      if (totalSize > MAX_UNPACKED_TOTAL_BYTES) throw new Error(EXPANDS_TOO_MUCH_MESSAGE);
    }
    offset += 512 + rounded(size);
  }
  return entries;
}
