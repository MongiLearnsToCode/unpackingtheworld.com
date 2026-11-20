#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const licenseKey = process.argv[2];
if (!licenseKey || !/^[0-9a-fA-F-]{36}$/.test(licenseKey)) {
  console.error("Usage: npm run support:lookup -- <license_key>");
  process.exit(2);
}

try {
  const output = execFileSync(
    "npx",
    ["wrangler", "kv", "key", "get", `license:${licenseKey}`, "--binding", "LICENSES", "--remote"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  console.log(output.trim() || "No license record found.");
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(`Lookup failed: ${detail}`);
  process.exit(1);
}
