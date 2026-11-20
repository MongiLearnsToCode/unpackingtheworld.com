/** Shared archive limits. Every user-facing message derives from these values. */
export const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
export const MAX_UNPACKED_ENTRY_BYTES = 64 * 1024 * 1024;
export const MAX_UNPACKED_TOTAL_BYTES = 512 * 1024 * 1024;
export const MAX_ARCHIVE_ENTRIES = 10_000;

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

export const TOO_LARGE_MESSAGE =
  `Archive exceeds the ${mb(MAX_ARCHIVE_BYTES)} MB limit. Nothing was uploaded; the file was only read in this tab.`;
export const ENTRY_TOO_LARGE_MESSAGE =
  `An entry in this archive expands beyond the ${mb(MAX_UNPACKED_ENTRY_BYTES)} MB safety limit, so it was rejected rather than opened.`;
export const EXPANDS_TOO_MUCH_MESSAGE =
  `This archive expands beyond the ${mb(MAX_UNPACKED_TOTAL_BYTES)} MB safety limit, so it was rejected rather than opened.`;
export const TOO_MANY_ENTRIES_MESSAGE =
  `This archive lists more than ${MAX_ARCHIVE_ENTRIES.toLocaleString("en-US")} entries, so it was rejected.`;
