import { bitStringBytes, decodeOid, innerDer, integerBitLength, readTlv, sequence, type Tlv } from "./der.ts";
import type { Field, Flag, Unpacked, Unpacker } from "./types.ts";
import { b64ToBytes, relativeTime } from "./util.ts";

const SIG_ALGS: Record<string, string> = {
  "1.2.840.113549.1.1.5": "SHA-1 with RSA",
  "1.2.840.113549.1.1.11": "SHA-256 with RSA",
  "1.2.840.113549.1.1.12": "SHA-384 with RSA",
  "1.2.840.113549.1.1.13": "SHA-512 with RSA",
  "1.2.840.10045.4.1": "ECDSA with SHA-1",
  "1.2.840.10045.4.3.2": "ECDSA with SHA-256",
  "1.2.840.10045.4.3.3": "ECDSA with SHA-384",
  "1.2.840.10045.4.3.4": "ECDSA with SHA-512",
  "1.3.101.112": "Ed25519",
  "1.3.101.113": "Ed448",
};

const NAME_OIDS: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.5": "SERIALNUMBER",
  "1.2.840.113549.1.9.1": "emailAddress",
};

const CURVES: Record<string, { name: string; bits: number }> = {
  "1.2.840.10045.3.1.7": { name: "P-256 / secp256r1", bits: 256 },
  "1.3.132.0.34": { name: "P-384 / secp384r1", bits: 384 },
  "1.3.132.0.35": { name: "P-521 / secp521r1", bits: 521 },
  "1.3.132.0.10": { name: "secp256k1", bits: 256 },
};

interface Algorithm {
  oid: string;
  params: Tlv | null;
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  serial: string;
  notBefore: Date;
  notAfter: Date;
  sans: string[];
  keyAlgorithm: string;
  keySize?: number;
  curve?: string;
  signatureAlgorithm: string;
}

function algorithmOf(tlv: Tlv): Algorithm {
  const items = sequence(tlv);
  if (!items.length || items[0].tag !== 0x06) throw new Error("Bad algorithm identifier");
  return { oid: decodeOid(items[0].value), params: items[1] ?? null };
}

function text(tlv: Tlv): string {
  return new TextDecoder().decode(tlv.value);
}

function parseTime(tlv: Tlv): Date {
  const s = text(tlv);
  if (tlv.tag === 0x17) {
    const yy = Number(s.slice(0, 2));
    const year = yy >= 50 ? 1900 + yy : 2000 + yy;
    return new Date(Date.UTC(year, Number(s.slice(2, 4)) - 1, Number(s.slice(4, 6)), Number(s.slice(6, 8)), Number(s.slice(8, 10)), Number(s.slice(10, 12))));
  }
  return new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)), Number(s.slice(8, 10)), Number(s.slice(10, 12)), Number(s.slice(12, 14))));
}

function setOf(tlv: Tlv): Tlv[] {
  if (tlv.tag !== 0x31) throw new Error("Expected a DER SET");
  const items: Tlv[] = [];
  let pos = 0;
  while (pos < tlv.value.length) {
    const item = readTlv(tlv.value, pos);
    items.push(item);
    pos = item.end;
  }
  return items;
}

function distinguishedName(tlv: Tlv): string {
  const parts: string[] = [];
  for (const rdn of sequence(tlv)) {
    const attribute = setOf(rdn)[0];
    if (!attribute) continue;
    const pair = sequence(attribute);
    if (pair.length < 2) continue;
    const oid = decodeOid(pair[0].value);
    parts.push(`${NAME_OIDS[oid] ?? oid}=${text(pair[1])}`);
  }
  return parts.join(", ");
}

function ipAddress(bytes: Uint8Array): string {
  if (bytes.length === 4) return Array.from(bytes, (b) => String(b)).join(".");
  if (bytes.length === 16) return Array.from({ length: 8 }, (_, i) => Array.from(bytes.slice(i * 2, i * 2 + 2), (b) => b.toString(16).padStart(2, "0")).join("")).join(":");
  return "invalid IP";
}

function subjectAltNames(tlv: Tlv | undefined): string[] {
  if (!tlv || tlv.tag !== 0xa3) return [];
  const list = sequence(readTlv(tlv.value, 0));
  let sanValue: Uint8Array | null = null;
  for (const ext of list) {
    const parts = sequence(ext);
    if (parts.length < 2) continue;
    if (decodeOid(parts[0].value) === "2.5.29.17") {
      const index = parts[1].tag === 0x01 ? 2 : 1;
      sanValue = parts[index]?.value ?? null;
    }
  }
  if (!sanValue) return [];
  const names: string[] = [];
  for (const generalName of sequence(readTlv(sanValue, 0))) {
    if (generalName.tag === 0x82) names.push(text(generalName));
    else if (generalName.tag === 0x81) names.push(text(generalName));
    else if (generalName.tag === 0x87) names.push(ipAddress(generalName.value));
  }
  return names;
}

function publicKeyInfo(spki: Tlv): { algorithm: string; size?: number; curve?: string } {
  const parts = sequence(spki);
  const alg = algorithmOf(parts[0]);
  if (alg.oid === "1.2.840.113549.1.1.1") {
    const body = sequence(readTlv(innerDer(parts[1]), 0));
    return { algorithm: "RSA", size: integerBitLength(body[0].value) };
  }
  if (alg.oid === "1.2.840.10045.2.1") {
    const curve = alg.params ? CURVES[decodeOid(alg.params.value)] : undefined;
    return { algorithm: "EC", size: curve?.bits, curve: curve?.name };
  }
  if (alg.oid === "1.3.101.112") return { algorithm: "Ed25519", size: 256 };
  if (alg.oid === "1.3.101.113") return { algorithm: "Ed448", size: 448 };
  return { algorithm: "Unknown" };
}

export function parseCertificate(input: string): CertificateInfo {
  const match = input.match(/-----BEGIN CERTIFICATE-----\s*([\s\S]*?)\s*-----END CERTIFICATE-----/);
  if (!match) throw new Error("No CERTIFICATE block found");
  const bytes = b64ToBytes(match[1].replace(/\s+/g, ""));
  if (!bytes) throw new Error("Certificate body is not valid Base64");

  const certificate = sequence(readTlv(bytes, 0));
  const tbs = sequence(certificate[0]);
  let i = 0;
  if (tbs[0].tag === 0xa0) i = 1;
  const serial = tbs[i++];
  const signature = algorithmOf(tbs[i++]);
  const issuer = distinguishedName(tbs[i++]);
  const validity = sequence(tbs[i++]);
  const subject = distinguishedName(tbs[i++]);
  const spki = tbs[i++];
  while (tbs[i] && (tbs[i].tag === 0x81 || tbs[i].tag === 0x82)) i++;
  const extensions = tbs[i]?.tag === 0xa3 ? tbs[i] : undefined;

  const key = publicKeyInfo(spki);
  return {
    subject,
    issuer,
    serial: serial ? Array.from(serial.value, (b) => b.toString(16).padStart(2, "0")).join("") : "",
    notBefore: parseTime(validity[0]),
    notAfter: parseTime(validity[1]),
    sans: subjectAltNames(extensions),
    keyAlgorithm: key.algorithm,
    keySize: key.size,
    curve: key.curve,
    signatureAlgorithm: SIG_ALGS[signature.oid] ?? signature.oid,
  };
}

function normalize(input: string): string {
  return input
    .trim()
    .replace(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*["']?(?=-----BEGIN)/gm, "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n");
}

function damaged(reason: string): Unpacked {
  return {
    id: "x509",
    label: "Certificate",
    headline: "Damaged certificate",
    flags: [{ severity: "bad", text: `Damaged certificate: ${reason}` }],
    fields: [],
    sections: [],
  };
}

export function unpackCertificate(input: string, now = Date.now()): Unpacked | null {
    const source = normalize(input);
    if (!/-----BEGIN CERTIFICATE-----/.test(source)) return null;
    let cert: CertificateInfo;
    try {
      cert = parseCertificate(source);
    } catch (error) {
      return damaged(error instanceof Error ? error.message : "unreadable certificate");
    }

    const flags: Flag[] = [];
    if (cert.notAfter.getTime() < now) {
      flags.push({ severity: "bad", text: `Expired ${relativeTime(cert.notAfter.getTime() / 1000, now)}` });
    } else if (cert.notBefore.getTime() > now) {
      flags.push({ severity: "warn", text: `Not valid yet (starts ${relativeTime(cert.notBefore.getTime() / 1000, now)})` });
    } else {
      flags.push({ severity: "good", text: `Valid, expires ${relativeTime(cert.notAfter.getTime() / 1000, now)}` });
    }
    if (cert.subject === cert.issuer) flags.push({ severity: "info", text: "Self-signed certificate" });
    if (cert.signatureAlgorithm.includes("SHA-1")) flags.push({ severity: "warn", text: "Weak signature algorithm (SHA-1)" });
    if (cert.keyAlgorithm === "RSA" && cert.keySize !== undefined && cert.keySize < 2048) {
      flags.push({ severity: "warn", text: `Weak public key: RSA ${cert.keySize} bits` });
    }

    const fields: Field[] = [
      { label: "subject", value: cert.subject },
      { label: "issuer", value: cert.issuer },
      { label: "serial", value: cert.serial },
      { label: "valid from", value: cert.notBefore.toISOString() },
      { label: "valid to", value: cert.notAfter.toISOString() },
      { label: "signature", value: cert.signatureAlgorithm },
      { label: "public key", value: cert.curve ? `${cert.keyAlgorithm} ${cert.curve}` : `${cert.keyAlgorithm}${cert.keySize ? ` ${cert.keySize} bits` : ""}` },
    ];
    if (cert.sans.length) fields.push({ label: "names (SAN)", value: cert.sans.join(", ") });

    const headline = flags.find((f) => /^(Expired|Valid|Not valid)/.test(f.text))?.text;
    return { id: "x509", label: "Certificate", headline, flags, fields, sections: [] };
}

export const x509: Unpacker = {
  id: "x509",
  label: "Certificate",
  score(input) {
    return /-----BEGIN CERTIFICATE-----/.test(normalize(input)) ? 0.95 : 0;
  },
  unpack(input) {
    return unpackCertificate(input);
  },
};
