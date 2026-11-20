import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { detect, unpack } from "./index.ts";

type PrivType = "pkcs1" | "pkcs8" | "sec1";
type PubType = "pkcs1" | "spki";

interface Pair {
  private: string;
  public: string;
}

function rsa(bits: number, privType: "pkcs1" | "pkcs8" = "pkcs8", pubType: PubType = "spki"): Pair {
  const pair = generateKeyPairSync("rsa", {
    modulusLength: bits,
    privateKeyEncoding: { type: privType, format: "pem" },
    publicKeyEncoding: { type: pubType, format: "pem" },
  });
  return { private: pair.privateKey, public: pair.publicKey };
}

function ec(namedCurve: string, privType: "pkcs8" | "sec1" = "sec1"): Pair {
  const pair = generateKeyPairSync("ec", {
    namedCurve,
    privateKeyEncoding: { type: privType, format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { private: pair.privateKey, public: pair.publicKey };
}

function ed25519(): Pair {
  const pair = generateKeyPairSync("ed25519", {
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  return { private: pair.privateKey, public: pair.publicKey };
}

function body(pem: string): string {
  return pem
    .split("\n")
    .filter((line) => !line.startsWith("-----"))
    .join("")
    .trim();
}

test("RSA 2048 PKCS#8 private key: algorithm, size, form and private-key flag", () => {
  const r = unpack("pem", rsa(2048).private)!;
  assert.equal(r.id, "pem");
  assert.equal(r.fields.find((f) => f.label === "algorithm")?.value, "RSA");
  assert.equal(r.fields.find((f) => f.label === "key size")?.value, "2048 bits");
  assert.equal(r.fields.find((f) => f.label === "form")?.value, "PKCS#8");
  assert.equal(r.fields.find((f) => f.label === "type")?.value, "Private key");
  assert.ok(r.flags.some((f) => f.severity === "bad" && /Private key/i.test(f.text)));
});

test("RSA 1024 is flagged as weak", () => {
  const r = unpack("pem", rsa(1024).private)!;
  assert.equal(r.fields.find((f) => f.label === "key size")?.value, "1024 bits");
  assert.ok(r.flags.some((f) => f.severity === "warn" && /under 2048/i.test(f.text)));
});

test("RSA PKCS#1 private and public keys", () => {
  const pair = rsa(2048, "pkcs1", "pkcs1");
  const priv = unpack("pem", pair.private)!;
  assert.equal(priv.fields.find((f) => f.label === "form")?.value, "PKCS#1");
  assert.equal(priv.fields.find((f) => f.label === "key size")?.value, "2048 bits");
  const pub = unpack("pem", pair.public)!;
  assert.equal(pub.fields.find((f) => f.label === "type")?.value, "Public key");
  assert.equal(pub.fields.find((f) => f.label === "key size")?.value, "2048 bits");
  assert.ok(pub.flags.some((f) => f.severity === "good"));
  assert.ok(!pub.flags.some((f) => /Private key/i.test(f.text)));
});

test("RSA SPKI public key", () => {
  const r = unpack("pem", rsa(2048).public)!;
  assert.equal(r.fields.find((f) => f.label === "form")?.value, "SPKI");
  assert.equal(r.fields.find((f) => f.label === "algorithm")?.value, "RSA");
  assert.equal(r.fields.find((f) => f.label === "key size")?.value, "2048 bits");
});

test("EC SEC1 private key reports curve and key size", () => {
  const r = unpack("pem", ec("prime256v1").private)!;
  assert.equal(r.fields.find((f) => f.label === "algorithm")?.value, "EC");
  assert.equal(r.fields.find((f) => f.label === "key size")?.value, "256 bits");
  assert.match(r.fields.find((f) => f.label === "curve")?.value ?? "", /P-256/);
});

test("EC P-384 PKCS#8 private key", () => {
  const r = unpack("pem", ec("secp384r1", "pkcs8").private)!;
  assert.equal(r.fields.find((f) => f.label === "form")?.value, "PKCS#8");
  assert.equal(r.fields.find((f) => f.label === "key size")?.value, "384 bits");
  assert.match(r.fields.find((f) => f.label === "curve")?.value ?? "", /P-384/);
});

test("EC SPKI public key", () => {
  const r = unpack("pem", ec("prime256v1").public)!;
  assert.equal(r.fields.find((f) => f.label === "type")?.value, "Public key");
  assert.equal(r.fields.find((f) => f.label === "algorithm")?.value, "EC");
  assert.match(r.fields.find((f) => f.label === "curve")?.value ?? "", /P-256/);
});

test("Ed25519 private and public keys", () => {
  const pair = ed25519();
  const priv = unpack("pem", pair.private)!;
  assert.equal(priv.fields.find((f) => f.label === "algorithm")?.value, "Ed25519");
  assert.equal(priv.fields.find((f) => f.label === "key size")?.value, "256 bits");
  assert.ok(priv.flags.some((f) => f.severity === "bad"));
  const pub = unpack("pem", pair.public)!;
  assert.equal(pub.fields.find((f) => f.label === "type")?.value, "Public key");
  assert.ok(!pub.flags.some((f) => /Private key/i.test(f.text)));
});

test("NAME= prefix and \\n escapes from a .env file", () => {
  const key = rsa(2048).private;
  const env = `PRIVATE_KEY="${key.replace(/\n/g, "\\n")}"`;
  const r = unpack("pem", env)!;
  assert.equal(r.fields.find((f) => f.label === "key size")?.value, "2048 bits");
  assert.ok(r.flags.some((f) => /Private key/i.test(f.text)));
});

test("key pasted on a single line", () => {
  const key = rsa(2048).private;
  const oneLine = key.replace(/\n/g, "");
  const r = unpack("pem", oneLine)!;
  assert.equal(r.fields.find((f) => f.label === "algorithm")?.value, "RSA");
});

test("damaged base64 body yields an error flag, not an exception", () => {
  const input = "-----BEGIN RSA PRIVATE KEY-----\nnot!base64!!!!\n-----END RSA PRIVATE KEY-----";
  const r = unpack("pem", input)!;
  assert.ok(r.flags.some((f) => f.severity === "bad" && /Damaged/i.test(f.text)));
  assert.equal(r.sections.length, 0);
});

test("truncated DER yields an error flag", () => {
  const der = Buffer.from([0x30, 0x03, 0x02, 0x01, 0x01]).toString("base64");
  const input = `-----BEGIN RSA PRIVATE KEY-----\n${der}\n-----END RSA PRIVATE KEY-----`;
  const r = unpack("pem", input)!;
  assert.ok(r.flags.some((f) => f.severity === "bad" && /Truncated RSA key/i.test(f.text)));
});

test("encrypted private key is reported without attempting to parse", () => {
  const input = "-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----";
  const r = unpack("pem", input)!;
  assert.ok(r.flags.some((f) => /Encrypted private key/i.test(f.text)));
});

test("key material is never printed back", () => {
  const key = rsa(2048).private;
  const r = unpack("pem", key)!;
  const serialized = JSON.stringify(r);
  assert.ok(!serialized.includes(body(key).slice(0, 24)));
  assert.ok(!serialized.includes("MIIE"));
});

test("PEM detection ranks a key first and ignores certificates", () => {
  assert.equal(detect(rsa(2048).private)[0].unpacker.id, "pem");
  const cert = "-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----";
  assert.equal(detect(cert).find((d) => d.unpacker.id === "pem"), undefined);
});
