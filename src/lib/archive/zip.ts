import { inflateSync } from "fflate";

export interface ArchiveEntry {
  path: string;
  size: number;
  compressedSize: number;
  directory: boolean;
  read(): Promise<Uint8Array | null>;
}

interface Source {
  size: number;
  slice(start: number, end: number): { arrayBuffer(): Promise<ArrayBuffer> };
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

function view(data: Uint8Array): DataView {
  return new DataView(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength);
}

async function tail(source: Source, length: number): Promise<{ bytes: Uint8Array; start: number }> {
  const start = Math.max(0, source.size - length);
  return { bytes: new Uint8Array(await source.slice(start, source.size).arrayBuffer()), start };
}

export async function isZip(source: Source): Promise<boolean> {
  const head = new Uint8Array(await source.slice(0, 4).arrayBuffer());
  return head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && [0x03, 0x05, 0x07].includes(head[2]);
}

export async function readZip(source: Source): Promise<ArchiveEntry[]> {
  const { bytes: endBytes } = await tail(source, Math.min(source.size, 22 + 65535));
  let eocd = -1;
  for (let i = endBytes.length - 22; i >= 0; i--) {
    if (view(endBytes).getUint32(i, true) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a ZIP file: end-of-central-directory record not found");

  const dv = view(endBytes);
  const disk = dv.getUint16(eocd + 4, true);
  const entries = dv.getUint16(eocd + 10, true);
  const centralSize = dv.getUint32(eocd + 12, true);
  const centralOffset = dv.getUint32(eocd + 16, true);
  if (disk !== 0 || entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    throw new Error("ZIP64 archives are not supported");
  }
  if (entries === 0) return [];
  const central = new Uint8Array(await source.slice(centralOffset, centralOffset + centralSize).arrayBuffer());
  const cd = view(central);
  const result: ArchiveEntry[] = [];
  let pos = 0;

  for (let i = 0; i < entries; i++) {
    if (pos + 46 > central.length || cd.getUint32(pos, true) !== CENTRAL_SIGNATURE) {
      throw new Error("ZIP central directory is damaged");
    }
    const method = cd.getUint16(pos + 10, true);
    const compressedSize = cd.getUint32(pos + 20, true);
    const size = cd.getUint32(pos + 24, true);
    const nameLength = cd.getUint16(pos + 28, true);
    const extraLength = cd.getUint16(pos + 30, true);
    const commentLength = cd.getUint16(pos + 32, true);
    const localOffset = cd.getUint32(pos + 42, true);
    const nameBytes = central.subarray(pos + 46, pos + 46 + nameLength);
    const path = new TextDecoder().decode(nameBytes);
    pos += 46 + nameLength + extraLength + commentLength;

    result.push({
      path,
      size,
      compressedSize,
      directory: path.endsWith("/"),
      async read() {
        if (path.endsWith("/")) return null;
        const header = new Uint8Array(await source.slice(localOffset, localOffset + 30).arrayBuffer());
        if (view(header).getUint32(0, true) !== LOCAL_SIGNATURE) return null;
        const localName = view(header).getUint16(26, true);
        const localExtra = view(header).getUint16(28, true);
        const start = localOffset + 30 + localName + localExtra;
        const raw = new Uint8Array(await source.slice(start, start + compressedSize).arrayBuffer());
        if (method === 0) return raw;
        if (method === 8) return inflateSync(raw);
        throw new Error(`Unsupported ZIP compression method ${method}`);
      },
    });
  }
  return result;
}
