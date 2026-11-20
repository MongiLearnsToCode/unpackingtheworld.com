export interface Tlv {
  tag: number;
  value: Uint8Array;
  end: number;
}

export function readTlv(der: Uint8Array, pos: number): Tlv {
  if (pos >= der.length) throw new Error("Truncated DER data");
  const tag = der[pos++];
  if ((tag & 0x1f) === 0x1f) {
    while (pos < der.length && (der[pos] & 0x80) !== 0) pos++;
    if (pos >= der.length) throw new Error("Truncated DER tag");
    pos++;
  }
  if (pos >= der.length) throw new Error("Truncated DER length");
  let length = der[pos++];
  if ((length & 0x80) !== 0) {
    const count = length & 0x7f;
    if (count === 0 || count > 4) throw new Error("Unsupported DER length");
    length = 0;
    for (let i = 0; i < count; i++) {
      if (pos >= der.length) throw new Error("Truncated DER length");
      length = length * 256 + der[pos++];
    }
  }
  if (length > der.length - pos) throw new Error("DER value is shorter than its declared length");
  return { tag, value: der.subarray(pos, pos + length), end: pos + length };
}

export function sequence(tlv: Tlv): Tlv[] {
  if (tlv.tag !== 0x30) throw new Error("Expected a DER SEQUENCE");
  const items: Tlv[] = [];
  let pos = 0;
  while (pos < tlv.value.length) {
    const item = readTlv(tlv.value, pos);
    items.push(item);
    pos = item.end;
  }
  return items;
}

export function decodeOid(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  const first = bytes[0];
  const arc0 = first < 40 ? 0 : first < 80 ? 1 : 2;
  const parts = [String(arc0), String(first - arc0 * 40)];
  let value = 0n;
  for (let i = 1; i < bytes.length; i++) {
    value = (value << 7n) | BigInt(bytes[i] & 0x7f);
    if ((bytes[i] & 0x80) === 0) {
      parts.push(value.toString());
      value = 0n;
    }
  }
  return parts.join(".");
}

export function bitStringBytes(tlv: Tlv): Uint8Array {
  if (tlv.tag !== 0x03 || tlv.value.length < 1) throw new Error("Bad DER BIT STRING");
  return tlv.value.subarray(1);
}

export function innerDer(container: Tlv): Uint8Array {
  if (container.tag === 0x04) return container.value;
  if (container.tag === 0x03) return bitStringBytes(container);
  throw new Error("Unexpected key container");
}

export function integerBitLength(bytes: Uint8Array): number {
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  const first = bytes[i];
  if (first === undefined) return 0;
  let bits = 0;
  for (let v = first; v > 0; v >>= 1) bits++;
  return (bytes.length - i - 1) * 8 + bits;
}
