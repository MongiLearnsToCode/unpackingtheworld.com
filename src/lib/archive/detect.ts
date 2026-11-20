import { MAX_ARCHIVE_BYTES, TOO_LARGE_MESSAGE } from "./limits.ts";
import type { ArchiveSource } from "./source.ts";
import { isGzip, isTar, readTar } from "./tar.ts";
import { isZip, readZip, type ArchiveEntry } from "./zip.ts";

export { MAX_ARCHIVE_BYTES } from "./limits.ts";
export type { ArchiveSource } from "./source.ts";
export type { ArchiveEntry };

export async function readArchive(source: ArchiveSource): Promise<ArchiveEntry[]> {
  if (source.size > MAX_ARCHIVE_BYTES) throw new Error(TOO_LARGE_MESSAGE);
  if (await isZip(source)) return readZip(source);
  if ((await isGzip(source)) || (await isTar(source))) return readTar(source);
  throw new Error("Not a recognised archive (zip, tar or tar.gz). RAR, 7z, xz and zstd are not supported.");
}
