/** The structural view of a picked/dropped file that the archive readers need. */
export interface ArchiveSource {
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
  arrayBuffer(): Promise<ArrayBuffer>;
}
