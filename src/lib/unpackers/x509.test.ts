import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { detect, unpack } from "./index.ts";
import { parseCertificate, unpackCertificate } from "./x509.ts";

type KeyKind = "rsa2048" | "rsa1024" | "ec" | "ed25519";

interface CertOptions {
  key?: KeyKind;
  days?: number;
  cn?: string;
  san?: string[];
  digest?: "sha256" | "sha1";
}

interface Issued {
  cert: string;
  key: string;
}

function run(args: string[]): void {
  execFileSync("openssl", args, { stdio: "pipe" });
}

function keyArgs(kind: KeyKind, out: string): string[] {
  if (kind === "rsa2048") return ["genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", out];
  if (kind === "rsa1024") return ["genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:1024", "-out", out];
  if (kind === "ec") return ["genpkey", "-algorithm", "EC", "-pkeyopt", "ec_paramgen_curve:P-256", "-out", out];
  return ["genpkey", "-algorithm", "ED25519", "-out", out];
}

function selfSigned(options: CertOptions = {}): Issued {
  const dir = mkdtempSync(path.join(tmpdir(), "utw-cert-"));
  try {
    const keyPath = path.join(dir, "key.pem");
    const certPath = path.join(dir, "cert.pem");
    run(keyArgs(options.key ?? "rsa2048", keyPath));
    const args = [
      "req", "-new", "-x509", "-key", keyPath, "-out", certPath,
      "-days", String(options.days ?? 30),
      "-subj", `/CN=${options.cn ?? "example.com"}/O=Test Org/C=US`,
      `-${options.digest ?? "sha256"}`,
      "-addext", "basicConstraints=critical,CA:FALSE",
    ];
    if (options.san) args.push("-addext", `subjectAltName=${options.san.map((name) => `DNS:${name}`).join(",")}`);
    run(args);
    return { cert: readFileSync(certPath, "utf8"), key: readFileSync(keyPath, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function caIssued(): Issued {
  const dir = mkdtempSync(path.join(tmpdir(), "utw-cert-"));
  try {
    const caKey = path.join(dir, "ca-key.pem");
    const caCert = path.join(dir, "ca.pem");
    const key = path.join(dir, "key.pem");
    const csr = path.join(dir, "req.csr");
    const cert = path.join(dir, "cert.pem");
    run(keyArgs("rsa2048", caKey));
    run(["req", "-new", "-x509", "-key", caKey, "-out", caCert, "-days", "60", "-subj", "/CN=Test Root CA", "-sha256", "-addext", "basicConstraints=critical,CA:TRUE"]);
    run(keyArgs("rsa2048", key));
    run(["req", "-new", "-key", key, "-out", csr, "-subj", "/CN=leaf.example.com"]);
    run(["x509", "-req", "-in", csr, "-CA", caCert, "-CAkey", caKey, "-out", cert, "-days", "30", "-sha256"]);
    return { cert: readFileSync(cert, "utf8"), key: readFileSync(key, "utf8") };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("parses subject, issuer, SAN, signature and key details", () => {
  const cert = selfSigned({ cn: "example.com", san: ["example.com", "www.example.com"] }).cert;
  const info = parseCertificate(cert);
  assert.match(info.subject, /CN=example\.com/);
  assert.match(info.subject, /O=Test Org/);
  assert.equal(info.subject, info.issuer);
  assert.ok(info.sans.includes("example.com"));
  assert.ok(info.sans.includes("www.example.com"));
  assert.equal(info.signatureAlgorithm, "SHA-256 with RSA");
  assert.equal(info.keyAlgorithm, "RSA");
  assert.equal(info.keySize, 2048);
  const result = unpack("x509", cert)!;
  assert.ok(result.flags.some((f) => f.text === "Self-signed certificate"));
  assert.ok(result.flags.some((f) => f.severity === "good"));
});

test("flags an expired certificate", () => {
  const cert = selfSigned({ days: 1 }).cert;
  const result = unpackCertificate(cert, Date.now() + 90 * 86400000)!;
  assert.ok(result.flags.some((f) => f.severity === "bad" && f.text.startsWith("Expired")));
});

test("flags a not-yet-valid certificate", () => {
  const cert = selfSigned({ days: 30 }).cert;
  const result = unpackCertificate(cert, Date.now() - 90 * 86400000)!;
  assert.ok(result.flags.some((f) => f.severity === "warn" && f.text.startsWith("Not valid yet")));
});

test("flags a weak RSA key", () => {
  const result = unpack("x509", selfSigned({ key: "rsa1024" }).cert)!;
  assert.ok(result.flags.some((f) => f.severity === "warn" && /Weak public key: RSA 1024/.test(f.text)));
});

test("flags a SHA-1 signature", () => {
  const result = unpack("x509", selfSigned({ digest: "sha1" }).cert)!;
  assert.ok(result.flags.some((f) => /SHA-1/.test(f.text)));
});

test("reports EC curve and Ed25519 keys", () => {
  const ec = unpack("x509", selfSigned({ key: "ec" }).cert)!;
  assert.match(ec.fields.find((f) => f.label === "public key")?.value ?? "", /P-256/);
  const ed = unpack("x509", selfSigned({ key: "ed25519" }).cert)!;
  assert.match(ed.fields.find((f) => f.label === "public key")?.value ?? "", /Ed25519/);
});

test("a CA-issued certificate is not self-signed", () => {
  const result = unpack("x509", caIssued().cert)!;
  assert.ok(!result.flags.some((f) => /Self-signed/.test(f.text)));
  assert.notEqual(
    result.fields.find((f) => f.label === "subject")?.value,
    result.fields.find((f) => f.label === "issuer")?.value,
  );
});

test("a damaged certificate yields an error flag and no bytes", () => {
  const input = "-----BEGIN CERTIFICATE-----\nnot!base64\n-----END CERTIFICATE-----";
  const result = unpack("x509", input)!;
  assert.ok(result.flags.some((f) => f.severity === "bad" && /Damaged certificate/.test(f.text)));
  assert.equal(result.sections.length, 0);
});

test("certificate bytes are never printed back", () => {
  const cert = selfSigned().cert;
  const result = unpack("x509", cert)!;
  const body = cert.split("\n").filter((line) => !line.startsWith("-----")).join("").trim();
  assert.ok(!JSON.stringify(result).includes(body.slice(0, 24)));
});

test("certificates detect as X.509 and PEM ignores them", () => {
  const cert = selfSigned().cert;
  assert.equal(detect(cert)[0].unpacker.id, "x509");
  assert.equal(detect(cert).find((d) => d.unpacker.id === "pem"), undefined);
});
