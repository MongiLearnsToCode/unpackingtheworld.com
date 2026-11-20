import assert from "node:assert/strict";
import { test } from "node:test";
import { addHistory, clearHistory, configureHistory, getHistory, isHistoryEnabled, setHistoryEnabled } from "./history.ts";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

function reset(storage: unknown): void {
  configureHistory({ storage: storage as never, enabled: false });
  clearHistory();
}

test("history is off by default and stores nothing", () => {
  const storage = memoryStorage();
  reset(storage);
  addHistory("secret-token");
  assert.equal(isHistoryEnabled(), false);
  assert.deepEqual(getHistory(), []);
});

test("enabling history stores and de-duplicates recent inputs", () => {
  const storage = memoryStorage();
  reset(storage);
  setHistoryEnabled(true);
  addHistory("first");
  addHistory("second");
  addHistory("first");
  assert.deepEqual(getHistory(), ["first", "second"]);
  assert.ok(storage.getItem("utw-history"));
});

test("history respects the limit", () => {
  const storage = memoryStorage();
  reset(storage);
  setHistoryEnabled(true);
  for (let i = 0; i < 30; i++) addHistory(`input-${i}`, 5);
  assert.equal(getHistory().length, 5);
  assert.equal(getHistory()[0], "input-29");
});

test("disabling history clears stored inputs", () => {
  const storage = memoryStorage();
  reset(storage);
  setHistoryEnabled(true);
  addHistory("stored");
  setHistoryEnabled(false);
  assert.equal(storage.getItem("utw-history"), null);
  assert.deepEqual(getHistory(), []);
});

test("works with missing or blocked storage", () => {
  reset(null);
  setHistoryEnabled(true);
  addHistory("no-storage");
  assert.deepEqual(getHistory(), []);

  const blocked = {
    getItem(): string | null { throw new Error("blocked"); },
    setItem(): void { throw new Error("blocked"); },
    removeItem(): void { throw new Error("blocked"); },
  };
  reset(blocked);
  setHistoryEnabled(true);
  addHistory("blocked-storage");
  assert.deepEqual(getHistory(), []);
  clearHistory();
});
