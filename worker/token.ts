export interface EntitlementPayload {
  v: 1;
  tier: "pro";
  lid: string;
  iat: number;
  exp: number;
}

const TOKEN_LIFETIME_SECONDS = 10 * 365 * 24 * 60 * 60;

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function licenseHash(licenseKey: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(licenseKey));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signEntitlementToken(
  licenseKey: string,
  privateKeyPem: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const payload: EntitlementPayload = {
    v: 1,
    tier: "pro",
    lid: await licenseHash(licenseKey),
    iat: nowSeconds,
    exp: nowSeconds + TOKEN_LIFETIME_SECONDS,
  };
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(privateKeyPem), { name: "Ed25519" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("Ed25519", key, new TextEncoder().encode(body));
  return `${body}.${base64url(new Uint8Array(signature))}`;
}

function fromBase64url(value: string): Uint8Array {
  const standard = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(standard + "=".repeat((4 - (standard.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function verifyEntitlementToken(
  token: string,
  publicKeyHex: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<EntitlementPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const raw = new Uint8Array(new ArrayBuffer(publicKeyHex.length / 2));
    for (let i = 0; i < raw.length; i++) raw[i] = Number.parseInt(publicKeyHex.slice(i * 2, i * 2 + 2), 16);
    const publicKey = await crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("Ed25519", publicKey, fromBase64url(parts[1]), new TextEncoder().encode(parts[0]));
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0]))) as EntitlementPayload;
    if (payload?.v !== 1 || payload.tier !== "pro" || typeof payload.exp !== "number") return null;
    if (payload.exp <= nowSeconds) return null;
    return payload;
  } catch {
    return null;
  }
}
