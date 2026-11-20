import { gunzipSync } from "fflate";
import type { ArchiveEntry } from "./zip.ts";

interface Source {
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export async function isGzip(source: Source): Promise<boolean> {
  const head = new Uint8Array(await source.slice(0, 2).arrayBuffer());
  return head.length === 2 && head[0] === 0x1f && head[1] === 0x8b;
}

export async function isTar(source: Source): Promise<boolean> {
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

export async function readTar(source: Source): Promise<ArchiveEntry[]> {
  let bytes = new Uint8Array(await source.arrayBuffer());
  if (await isGzip(source)) bytes = gunzipSync(bytes);

  const entries: ArchiveEntry[] = [];
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
    }
    offset += 512 + rounded(size);
  }
  return entries;
}
