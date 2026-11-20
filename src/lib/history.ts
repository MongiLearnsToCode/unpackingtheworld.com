const STORAGE_KEY = "utw-history";
const DEFAULT_LIMIT = 20;

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let storage: KeyValueStorage | null = typeof localStorage === "undefined" ? null : localStorage;
let enabled = false;

export function configureHistory(options: { storage?: KeyValueStorage | null; enabled?: boolean }): void {
  if ("storage" in options) storage = options.storage ?? null;
  if (options.enabled !== undefined) enabled = options.enabled;
}

export function isHistoryEnabled(): boolean {
  return enabled;
}

export function setHistoryEnabled(value: boolean): void {
  enabled = value;
  if (!enabled) clearHistory();
}

export function getHistory(): string[] {
  if (!enabled) return [];
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function addHistory(input: string, limit = DEFAULT_LIMIT): void {
  if (!enabled || !input.trim()) return;
  const next = [input, ...getHistory().filter((item) => item !== input)].slice(0, limit);
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
}

export function clearHistory(): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    return;
  }
}
