import type { Field, Flag, Unpacker } from "./types.ts";
import { b64ToBytes, looksLikeText, tryJson, utf8 } from "./util.ts";

export const base64: Unpacker = {
  id: "base64",
  label: "Base64",
  score(input) {
    const s = input.trim();
    if (s.length < 8) return 0;
    const bytes = b64ToBytes(s);
    if (!bytes) return 0;
    const text = utf8(bytes);
    if (text === null || !looksLikeText(text)) {
      return /[+/=_-]/.test(s) || /\d/.test(s) ? 0.45 : 0;
    }
    // Plain words like "helloworld" are valid base64 chars but unlikely to be meant as such
    const hasMarkers = /[+/=_-]/.test(s) || /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s);
    return hasMarkers ? 0.7 : 0.35;
  },
  unpack(input) {
    const bytes = b64ToBytes(input);
    if (!bytes) return null;
    const flags: Flag[] = [];
    const fields: Field[] = [
      { label: "bytes", value: String(bytes.length) },
      { label: "variant", value: /[-_]/.test(input) ? "base64url" : "standard" },
    ];
    const text = utf8(bytes);
    if (text === null || !looksLikeText(text)) {
      flags.push({ severity: "warn" as const, text: "Decoded data is binary, not text" });
      const hex = Array.from(bytes.slice(0, 64), (b) => b.toString(16).padStart(2, "0")).join(" ");
      return {
        id: "base64",
        label: "Base64",
        flags,
        fields,
        sections: [],
        text: hex + (bytes.length > 64 ? " …" : ""),
      };
    }
    const json = tryJson(text);
    if (json !== undefined && typeof json === "object" && json !== null) {
      flags.push({ severity: "info" as const, text: "Decoded value is JSON" });
      return { id: "base64", label: "Base64", flags, fields, sections: [{ title: "Decoded JSON", json }] };
    }
    return { id: "base64", label: "Base64", flags, fields, sections: [], text };
  },
};
