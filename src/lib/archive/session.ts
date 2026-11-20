import { MAX_ARCHIVE_BYTES, readArchive, type ArchiveEntry } from "./detect.ts";

/** Text previews are capped so a huge log file cannot freeze the pane. */
export const MAX_PREVIEW_BYTES = 64 * 1024;

export interface ArchiveSession {
  name: string;
  entries: ArchiveEntry[];
}

const mb = Math.round(MAX_ARCHIVE_BYTES / (1024 * 1024));

export async function openArchive(file: File): Promise<ArchiveSession> {
  if (file.size > MAX_ARCHIVE_BYTES) {
    throw new Error(`That archive is over the ${mb} MB cap. Nothing was uploaded.`);
  }
  const entries = await readArchive(file);
  return { name: file.name, entries };
}

export async function previewEntry(entry: ArchiveEntry): Promise<string> {
  if (entry.size > MAX_PREVIEW_BYTES) {
    throw new Error(`Preview is limited to ${Math.round(MAX_PREVIEW_BYTES / 1024)} kB`);
  }
  const bytes = await entry.read();
  if (!bytes) throw new Error("That entry has no readable content");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("That entry is binary, not text");
  }
}
