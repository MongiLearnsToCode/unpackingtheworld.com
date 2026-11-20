import { bitStringBytes, decodeOid, innerDer, integerBitLength, readTlv, sequence, type Tlv } from "./der.ts";
import type { Field, Flag, Unpacker } from "./types.ts";
import { b64ToBytes } from "./util.ts";

interface KeyInfo {
  form: string;
  private: boolean;
  algorithm: string;
  size?: number;
  curve?: string;
}

interface Algorithm {
  oid: string;
  params: Tlv | null;
}

const OID = {
  rsa: "1.2.840.113549.1.1.1",
  ec: "1.2.840.10045.2.1",
  ed25519: "1.3.101.112",
  ed448: "1.3.101.113",
  p256: "1.2.840.10045.3.1.7",
  p384: "1.3.132.0.34",
  p521: "1.3.132.0.35",
  secp256k1: "1.3.132.0.10",
  p192: "1.2.840.10045.3.1.1",
} as const;

const CURVES: Record<string, { name: string; bits: number }> = {
  [OID.p256]: { name: "P-256 / secp256r1 (prime256v1)", bits: 256 },
  [OID.p384]: { name: "P-384 / secp384r1", bits: 384 },
  [OID.p521]: { name: "P-521 / secp521r1", bits: 521 },
  [OID.secp256k1]: { name: "secp256k1", bits: 256 },
  [OID.p192]: { name: "P-192 / secp192r1 (prime192v1)", bits: 192 },
};

function algorithmOf(tlv: Tlv): Algorithm {
  const items = sequence(tlv);
  if (!items.length || items[0].tag !== 0x06) throw new Error("Bad algorithm identifier");
  return { oid: decodeOid(items[0].value), params: items[1] ?? null };
}

function infoFromAlgorithm(alg: Algorithm, container: Tlv, form: string, isPrivate: boolean): KeyInfo {
  if (alg.oid === OID.rsa) {
    const body = sequence(readTlv(innerDer(container), 0));
    const modulus = isPrivate ? body[1] : body[0];
    if (!modulus) throw new Error("Truncated RSA key");
    const size = integerBitLength(modulus.value);
    if (size === 0) throw new Error("Invalid RSA modulus");
    return { form, private: isPrivate, algorithm: "RSA", size };
  }
  if (alg.oid === OID.ec) {
    const oid = alg.params && alg.params.tag === 0x06 ? decodeOid(alg.params.value) : "";
    const curve = CURVES[oid];
    if (!curve) throw new Error("Unknown or missing EC curve");
    return { form, private: isPrivate, algorithm: "EC", size: curve.bits, curve: curve.name };
  }
  if (alg.oid === OID.ed25519) {
    return { form, private: isPrivate, algorithm: "Ed25519", size: 256 };
  }
  if (alg.oid === OID.ed448) {
    return { form, private: isPrivate, algorithm: "Ed448", size: 448 };
  }
  throw new Error("Unsupported key algorithm");
}

function parsePkcs8(top: Tlv): KeyInfo {
  const items = sequence(top);
  if (items.length < 3) throw new Error("Truncated PKCS#8 key");
  return infoFromAlgorithm(algorithmOf(items[1]), items[2], "PKCS#8", true);
}

function parseSpki(top: Tlv): KeyInfo {
  const items = sequence(top);
  if (items.length < 2) throw new Error("Truncated public key");
  return infoFromAlgorithm(algorithmOf(items[0]), items[1], "SPKI", false);
}

function parseSec1(top: Tlv): KeyInfo {
  const items = sequence(top);
  if (items.length < 2) throw new Error("Truncated EC key");
  let oid = "";
  let publicPoint: Uint8Array | null = null;
  for (const item of items) {
    if (item.tag === 0xa0) {
      const wrapped = readTlv(item.value, 0);
      if (wrapped.tag === 0x06) oid = decodeOid(wrapped.value);
    }
    if (item.tag === 0xa1) {
      const wrapped = readTlv(item.value, 0);
      publicPoint = bitStringBytes(wrapped);
    }
  }
  if (!oid && publicPoint) {
    const len = publicPoint.length;
    if (len === 65) oid = OID.p256;
    else if (len === 97) oid = OID.p384;
    else if (len === 133) oid = OID.p521;
    else if (len === 33) oid = OID.secp256k1;
  }
  const curve = CURVES[oid];
  if (!curve) throw new Error("Unknown or missing EC curve");
  return { form: "SEC1", private: true, algorithm: "EC", size: curve.bits, curve: curve.name };
}

function parseKey(label: string, der: Uint8Array): KeyInfo {
  const top = readTlv(der, 0);
  if (label === "RSA PRIVATE KEY") {
    const items = sequence(top);
    if (items.length < 2) throw new Error("Truncated RSA key");
    const size = integerBitLength(items[1].value);
    if (size === 0) throw new Error("Invalid RSA modulus");
    return { form: "PKCS#1", private: true, algorithm: "RSA", size };
  }
  if (label === "RSA PUBLIC KEY") {
    const items = sequence(top);
    if (!items.length) throw new Error("Truncated RSA key");
    const size = integerBitLength(items[0].value);
    if (size === 0) throw new Error("Invalid RSA modulus");
    return { form: "PKCS#1", private: false, algorithm: "RSA", size };
  }
  if (label === "PRIVATE KEY") return parsePkcs8(top);
  if (label === "PUBLIC KEY") return parseSpki(top);
  if (label === "EC PRIVATE KEY") return parseSec1(top);
  if (label === "ENCRYPTED PRIVATE KEY") throw new Error("Encrypted private key — cannot inspect without the passphrase");
  throw new Error("Unsupported PEM label");
}

function normalize(input: string): string {
  return input
    .trim()
    .replace(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*["']?(?=-----BEGIN)/gm, "")
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n");
}

function extractPem(input: string): { label: string; body: string } | null {
  const match = input.match(/-----BEGIN ([A-Z0-9 ]+)-----\s*([\s\S]*?)\s*-----END \1-----/);
  if (!match) return null;
  return { label: match[1].trim(), body: match[2].replace(/\s+/g, "") };
}

function damaged(label: string | undefined, reason: string) {
  const fields: Field[] = [];
  if (label) fields.push({ label: "PEM label", value: label });
  return {
    id: "pem",
    label: "PEM key",
    headline: "Damaged key",
    flags: [{ severity: "bad" as const, text: `Damaged or unsupported key: ${reason}` }],
    fields,
    sections: [],
  };
}

export const pem: Unpacker = {
  id: "pem",
  label: "PEM key",
  score(input) {
    const block = extractPem(normalize(input));
    if (!block || block.label === "CERTIFICATE") return 0;
    return 0.95;
  },
  unpack(input) {
    const block = extractPem(normalize(input));
    if (!block) return null;
    const bytes = b64ToBytes(block.body);
    if (!bytes || !bytes.length) return damaged(block.label, "key body is not valid Base64");

    let info: KeyInfo;
    try {
      info = parseKey(block.label, bytes);
    } catch (error) {
      return damaged(block.label, error instanceof Error ? error.message : "unreadable key data");
    }

    const fields: Field[] = [
      { label: "PEM label", value: block.label },
      { label: "form", value: info.form },
      { label: "type", value: info.private ? "Private key" : "Public key" },
      { label: "algorithm", value: info.algorithm },
    ];
    if (info.size !== undefined) fields.push({ label: "key size", value: `${info.size} bits` });
    if (info.curve) fields.push({ label: "curve", value: info.curve });

    const flags: Flag[] = [];
    if (info.private) {
      flags.push({ severity: "bad", text: "Private key — treat it as sensitive. Never paste it into an untrusted tool." });
    } else {
      flags.push({ severity: "good", text: "Public key — safe to share." });
    }
    if (info.algorithm === "RSA" && info.size !== undefined && info.size < 2048) {
      flags.push({ severity: "warn", text: `RSA ${info.size}-bit key is weak (under 2048 bits)` });
    }
    if (info.algorithm.startsWith("Ed")) {
      flags.push({ severity: "info", text: `${info.algorithm} uses a fixed key size; there is no smaller variant to choose.` });
    }

    const headline = `${info.private ? "Private" : "Public"} ${info.algorithm} key${info.size !== undefined ? ` · ${info.size} bits` : ""}`;
    return { id: "pem", label: "PEM key", headline, flags, fields, sections: [] };
  },
};
