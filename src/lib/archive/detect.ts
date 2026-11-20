import { isGzip, isTar, readTar } from "./tar.ts";
import { isZip, readZip, type ArchiveEntry } from "./zip.ts";

export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;

export interface ArchiveSource {
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type { ArchiveEntry };

export async function readArchive(source: ArchiveSource): Promise<ArchiveEntry[]> {
  if (source.size > MAX_ARCHIVE_BYTES) {
    throw new Error("Archive exceeds the 200 MB limit. Nothing was uploaded; the file was only read in this tab.");
  }
  if (await isZip(source)) return readZip(source);
  if ((await isGzip(source)) || (await isTar(source))) return readTar(source);
  throw new Error("Not a recognised archive (zip, tar or tar.gz). RAR, 7z, xz and zstd are not supported.");
}
