export type Severity = "info" | "warn" | "bad" | "good";

export interface Flag {
  severity: Severity;
  text: string;
}

export interface Field {
  label: string;
  value: string;
}

export interface Unpacked {
  id: string;
  label: string;
  /** Plain headline, e.g. "Expired 3 days ago" */
  headline?: string;
  flags: Flag[];
  fields: Field[];
  /** Sections of decoded JSON, shown as trees */
  sections: { title: string; json: unknown }[];
  /** Plain-text output when there's no structure */
  text?: string;
  /** One-click chains to another unpacker, offered by the results pane */
  next?: { label: string; input: string; id: string }[];
}

export interface Unpacker {
  id: string;
  label: string;
  /** 0 = no match, 1 = certain. */
  score(input: string): number;
  unpack(input: string): Unpacked | null;
}
