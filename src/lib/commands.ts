import { unpackers } from "./unpackers/index.ts";
import {
  sampleBase64,
  sampleCron,
  sampleHeaders,
  sampleHtmlEntities,
  sampleJwt,
  samplePem,
  sampleTimestamp,
  sampleUrl,
  sampleUserAgent,
  sampleUuid,
} from "./samples.ts";

export interface Command {
  value: string;
  label: string;
  group: string;
  run: () => void;
}

export interface CommandActions {
  setInput: (value: string) => void;
  /** `null` returns the tool to automatic format detection. */
  force: (id: string | null) => void;
  share: () => void;
  toggleTheme: () => void;
}

/** Everything the command palette can do, derived from the same unpacker list. */
export function buildCommands(actions: CommandActions): Command[] {
  const load = (id: string, label: string, sample: () => string): Command => ({
    value: `sample-${id}`,
    label: `Load sample ${label}`,
    group: "Samples",
    run: () => actions.setInput(sample()),
  });

  return [
    load("jwt", "JWT", sampleJwt),
    load("b64", "Base64", sampleBase64),
    load("url", "URL", sampleUrl),
    load("pem", "PEM key", samplePem),
    load("entities", "HTML entities", sampleHtmlEntities),
    load("timestamp", "Unix timestamp", sampleTimestamp),
    load("uuid", "UUID", sampleUuid),
    load("cron", "cron expression", sampleCron),
    load("ua", "User-Agent", sampleUserAgent),
    load("headers", "HTTP headers", sampleHeaders),
    ...unpackers.map((unpacker) => ({
      value: `as-${unpacker.id}`,
      label: `Unpack as ${unpacker.label}`,
      group: "Force format",
      run: () => actions.force(unpacker.id),
    })),
    { value: "auto", label: "Auto-detect format", group: "Force format", run: () => actions.force(null) },
    { value: "share", label: "Copy share link", group: "Actions", run: actions.share },
    { value: "clear", label: "Clear input", group: "Actions", run: () => actions.setInput("") },
    { value: "theme", label: "Toggle light / dark theme", group: "Actions", run: actions.toggleTheme },
  ];
}
