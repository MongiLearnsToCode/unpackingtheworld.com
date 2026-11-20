import type { Field, Flag, Unpacker } from "./types.ts";

const UUID = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i;
const UUID_EPOCH_MS = 12219292800000;

function embeddedTime(groups: string[], version: number): number | null {
  if (version === 1) {
    const ticks = (BigInt(`0x${groups[3][1]}${groups[3][2]}${groups[3][3]}`) << 48n)
      | (BigInt(`0x${groups[2]}`) << 32n)
      | BigInt(`0x${groups[1]}`);
    return Number(ticks / 10000n) - UUID_EPOCH_MS;
  }
  if (version === 7) {
    return Number(BigInt(`0x${groups[1]}${groups[2]}`));
  }
  return null;
}

export const uuid: Unpacker = {
  id: "uuid",
  label: "UUID",
  score(input) {
    return UUID.test(input.trim()) ? 0.95 : 0;
  },
  unpack(input) {
    const s = input.trim();
    const match = s.match(UUID);
    if (!match) return null;
    const groups = [s.replace(/-/g, ""), ...match.slice(1)];
    const digits = groups[0].toLowerCase();
    const version = Number.parseInt(match[3][0], 16);
    const variant = Number.parseInt(match[4][0], 16);
    const nil = /^0+$/.test(digits);
    const max = /^f+$/.test(digits);

    const flags: Flag[] = [];
    if (nil) flags.push({ severity: "warn" as const, text: "Nil UUID — all zeros, used as a placeholder" });
    else if (max) flags.push({ severity: "warn" as const, text: "Max UUID — all ones, used as a sentinel" });
    else flags.push({ severity: "good" as const, text: `Valid UUID${version >= 1 && version <= 8 ? ` version ${version}` : ""}` });

    flags.push({
      severity: variant >= 8 && variant <= 11 ? ("info" as const) : ("warn" as const),
      text: variant >= 8 && variant <= 11 ? "RFC 4122 variant" : "Non-RFC variant (legacy layout)",
    });

    const fields: Field[] = [
      { label: "version", value: version >= 1 && version <= 8 ? String(version) : "unknown" },
      { label: "variant", value: variant >= 8 && variant <= 11 ? "RFC 4122" : `non-RFC (${match[4][0]})` },
    ];

    if (!nil && !max) {
      const ms = embeddedTime(groups, version);
      if (ms !== null && Number.isFinite(ms)) {
        const date = new Date(ms);
        if (!Number.isNaN(date.getTime())) {
          fields.push({ label: "embedded time", value: date.toISOString() });
          flags.push({ severity: "info" as const, text: `Version ${version} embeds a timestamp` });
        }
      }
    }

    return { id: "uuid", label: "UUID", flags, fields, sections: [] };
  },
};
