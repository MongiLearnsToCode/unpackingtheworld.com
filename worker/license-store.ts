import type { KVLike, LicenseEvent, LicenseRecord } from "./types.ts";

const MAX_EVENTS = 100;
const IDEMPOTENCY_TTL_SECONDS = 30 * 24 * 60 * 60;

function recordKey(licenseKey: string): string {
  return `license:${licenseKey}`;
}

export async function getLicense(kv: KVLike, licenseKey: string): Promise<LicenseRecord | null> {
  const raw = await kv.get(recordKey(licenseKey));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LicenseRecord;
  } catch {
    return null;
  }
}

export async function putLicense(kv: KVLike, record: LicenseRecord): Promise<void> {
  await kv.put(recordKey(record.license_key), JSON.stringify(record));
}

export async function wasProcessed(kv: KVLike, idempotencyKey: string): Promise<boolean> {
  return (await kv.get(`event:${idempotencyKey}`)) !== null;
}

export async function markProcessed(kv: KVLike, idempotencyKey: string): Promise<void> {
  await kv.put(`event:${idempotencyKey}`, "1", { expirationTtl: IDEMPOTENCY_TTL_SECONDS });
}

export function idempotencyKey(licenseKey: string, event: string, createdAt: number): string {
  return `${licenseKey}:${event}:${createdAt}`;
}

function statusFor(event: string): LicenseRecord["status"] {
  if (event === "deactivate") return "deactivated";
  if (event === "activate") return "active";
  if (event === "upgrade" || event === "downgrade") return "active";
  return "inactive";
}

export async function applyEvent(kv: KVLike, payload: Record<string, unknown>): Promise<LicenseRecord | null> {
  const licenseKey = typeof payload.license_key === "string" ? payload.license_key : "";
  const event = typeof payload.event === "string" ? payload.event : "";
  if (!licenseKey || !event) return null;

  const createdAt = typeof payload.created_at === "number" ? payload.created_at : Date.now();
  const history: LicenseEvent = {
    event,
    created_at: createdAt,
    received_at: Date.now(),
    license_key: licenseKey,
    previous_key: typeof payload.prev_license_key === "string" ? payload.prev_license_key : undefined,
    tier: typeof payload.tier === "number" ? payload.tier : undefined,
    reason: typeof payload.extra === "object" && payload.extra !== null
      ? String((payload.extra as Record<string, unknown>).reason ?? "")
      : undefined,
  };

  const existing = await getLicense(kv, licenseKey);
  const record: LicenseRecord = {
    license_key: licenseKey,
    status: statusFor(event),
    tier: history.tier ?? existing?.tier ?? 1,
    updated_at: Date.now(),
    events: [...(existing?.events ?? []), history].slice(-MAX_EVENTS),
  };
  await putLicense(kv, record);

  const previous = history.previous_key;
  if (previous && (event === "upgrade" || event === "downgrade")) {
    const old = await getLicense(kv, previous);
    if (old) await putLicense(kv, { ...old, status: "deactivated", updated_at: Date.now() });
  }
  return record;
}
