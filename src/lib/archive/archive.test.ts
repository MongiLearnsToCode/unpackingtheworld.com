import assert from "node:assert/strict";
import { zipSync, gzipSync, strToU8 } from "fflate";
import { test } from "node:test";
import { MAX_ARCHIVE_BYTES, readArchive } from "./detect.ts";

function file(bytes: Uint8Array): File {
  return new File([bytes], "test.archive");
}

function writeString(target: Uint8Array, offset: number, length: number, value: string): void {
  target.set(new TextEncoder().encode(value).subarray(0, length), offset);
}

function makeTar(entries: { name: string; data?: string; directory?: boolean }[]): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    const header = new Uint8Array(512);
    writeString(header, 0, 100, entry.name);
    writeString(header, 100, 8, "0000644\0");
    writeString(header, 108, 8, "0000000\0");
    writeString(header, 116, 8, "0000000\0");
    const data = entry.data ? strToU8(entry.data) : new Uint8Array(0);
    writeString(header, 124, 12, `${data.length.toString(8).padStart(11, "0")}\0`);
    writeString(header, 136, 12, "00000000000\0");
    if (entry.directory) header[156] = 0x35;
    header.fill(0x20, 148, 156);
    writeString(header, 257, 6, "ustar\0");
    writeString(header, 263, 2, "00");
    let checksum = 0;
    for (const byte of header) checksum += byte;
    writeString(header, 148, 8, `${checksum.toString(8).padStart(6, "0")}\0 `);
    blocks.push(header);
    if (data.length) {
      blocks.push(data);
      const padding = (512 - (data.length % 512)) % 512;
      if (padding) blocks.push(new Uint8Array(padding));
    }
  }
  blocks.push(new Uint8Array(1024));
  const total = blocks.reduce((sum, block) => sum + block.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.length;
  }
  return result;
}

test("reads zip central directory with nested folders and empty files", async () => {
  const bytes = zipSync({
    "package/package.json": strToU8('{"name":"demo"}'),
    "package/src/index.ts": strToU8("export const ok = true;"),
    "package/empty.txt": new Uint8Array(0),
    "package/folder/": new Uint8Array(0),
  });
  const entries = await readArchive(file(bytes));
  assert.equal(entries.length, 4);
  assert.ok(entries.some((entry) => entry.path === "package/src/index.ts" && entry.size === 23));
  assert.ok(entries.some((entry) => entry.directory && entry.path.endsWith("/")));
  const decoded = await entries.find((entry) => entry.path === "package/package.json")!.read();
  assert.equal(new TextDecoder().decode(decoded!), '{"name":"demo"}');
});

test("shows path-traversal names as text without resolving them", async () => {
  const bytes = zipSync({ "../evil.txt": strToU8("not written anywhere") });
  const entries = await readArchive(file(bytes));
  assert.equal(entries[0].path, "../evil.txt");
  const decoded = await entries[0].read();
  assert.equal(new TextDecoder().decode(decoded!), "not written anywhere");
});

test("reads plain tar and tar.gz archives", async () => {
  const tar = makeTar([
    { name: "folder/", directory: true },
    { name: "folder/hello.txt", data: "hello from tar" },
  ]);
  for (const bytes of [tar, gzipSync(tar)]) {
    const entries = await readArchive(file(bytes));
    assert.ok(entries.some((entry) => entry.path === "folder/hello.txt"));
    const decoded = await entries.find((entry) => entry.path === "folder/hello.txt")!.read();
    assert.equal(new TextDecoder().decode(decoded!), "hello from tar");
  }
});

test("rejects corrupt and unsupported files with a clear message", async () => {
  await assert.rejects(() => readArchive(file(strToU8("this is not an archive at all"))), /Not a recognised archive/);
  const damaged = zipSync({ "a.txt": strToU8("a") });
  await assert.rejects(() => readArchive(file(damaged.subarray(0, damaged.length - 30))), /end-of-central-directory/i);
});

test("detects a Zip64 marker and fails clearly", async () => {
  const bytes = zipSync({ "a.txt": strToU8("a") });
  const eocd = bytes.length - 22;
  new DataView(bytes.buffer).setUint16(eocd + 4, 1, true);
  await assert.rejects(() => readArchive(file(bytes)), /ZIP64/);
});

test("enforces the 200 MB cap before reading anything", async () => {
  const huge = {
    size: MAX_ARCHIVE_BYTES + 1,
    slice: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
  await assert.rejects(() => readArchive(huge), /200 MB limit/);
});

test("lists a 50,000-entry archive without executing or rendering entries", async () => {
  const zippable: Record<string, Uint8Array> = {};
  for (let i = 0; i < 50000; i++) zippable[`files/${i}.txt`] = new Uint8Array(0);
  const bytes = zipSync(zippable);
  const started = performance.now();
  const entries = await readArchive(file(bytes));
  const elapsed = performance.now() - started;
  assert.equal(entries.length, 50000);
  assert.ok(entries[0].path.startsWith("files/"));
  console.log(`  50,000-entry listing: ${entries.length} entries in ${elapsed.toFixed(0)} ms, ${(bytes.length / 1024).toFixed(0)} kB archive`);
});
