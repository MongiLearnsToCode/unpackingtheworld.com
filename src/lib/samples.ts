const b64url = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export function sampleJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: "https://auth.example.com",
    sub: "user_8f3a21",
    aud: "api.example.com",
    name: "Ada Lovelace",
    roles: ["admin", "developer"],
    org: { id: 42, plan: "team" },
    iat: now - 3600,
    exp: now + 7200,
  };
  return `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}.${b64url("not-a-real-signature")}`;
}

export function sampleBase64(): string {
  return btoa(JSON.stringify({ message: "Hello from the other side", items: [1, 2, 3], ok: true }));
}

export function sampleUrl(): string {
  return "https://example.com/search%20results?q=unpacking+the+world&tags=a&tags=b&utm_source=newsletter#section-2";
}

export function samplePem(): string {
  return [
    "-----BEGIN PUBLIC KEY-----",
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArDILkB7JsU+/nLSaq0ql",
    "Vero1bFsiBXgThJ8zvhnmnepcwQtsQugUsq1A2K3cNGoko+Gfg1X1a8myyXT49kj",
    "+X9id43vaU0R4Z7nwetugce0/ZBskByslbLuuNe0lpT94h/qEJPWJk2M6E14Mx9k",
    "6KtUV/YUCA+9nRIbRg9OtE2dfhOfAJmxkclHcYqYnfF5tmQ276GVgC4hlNB6uPuh",
    "HMjKlk2/6t/17KcbK0RVCeQnfIKe9jP7Mw8C0XHDMN5iG6RwHV93E7axgTPzF70b",
    "uxXmKgKn38SNIaJ4bpXZ0ZHi/xXumbjN8t2f4BywT7S5Cynk2WdEXPbN5NU9RIIb",
    "6QIDAQAB",
    "-----END PUBLIC KEY-----",
  ].join("\n");
}
