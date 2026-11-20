import { UAParser } from "ua-parser-js";
import type { Field, Flag, Unpacker } from "./types.ts";

const BOT = /bot|crawler|spider|slurp|headless|playwright|puppeteer|curl|wget|python-requests|postman|axios/i;

export const useragent: Unpacker = {
  id: "useragent",
  label: "User-Agent",
  score(input) {
    const value = input.trim();
    if (value.length < 12 || value.length > 2000) return 0;
    if (/Mozilla\/[\d.]+/i.test(value) || /^(curl|wget|python|node|Postman|axios)/i.test(value)) return 0.9;
    return 0;
  },
  unpack(input) {
    const value = input.trim();
    let result: ReturnType<UAParser["getResult"]>;
    try {
      result = new UAParser(value).getResult();
    } catch {
      return null;
    }

    const fields: Field[] = [
      { label: "browser", value: result.browser.name || "unknown" },
      { label: "browser version", value: result.browser.version || "unknown" },
      { label: "engine", value: result.engine.name || "unknown" },
      { label: "engine version", value: result.engine.version || "unknown" },
      { label: "OS", value: result.os.name || "unknown" },
      { label: "OS version", value: result.os.version || "unknown" },
      { label: "device", value: [result.device.vendor, result.device.model].filter(Boolean).join(" ") || "unknown" },
      { label: "device type", value: result.device.type || "desktop / unknown" },
    ];

    const isBot = BOT.test(value);
    const flags: Flag[] = [];
    if (isBot) flags.push({ severity: "warn" as const, text: "Looks like a bot, crawler or scripted client" });
    if (!result.browser.name) flags.push({ severity: "info" as const, text: "Browser could not be identified from this string" });
    if (result.device.type) flags.push({ severity: "info" as const, text: `Device type: ${result.device.type}` });

    return {
      id: "useragent",
      label: "User-Agent",
      headline: [result.browser.name, result.browser.version, result.os.name].filter(Boolean).join(" · ") || "Unidentified client",
      flags,
      fields,
      sections: [],
    };
  },
};
