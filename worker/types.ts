import type { KVNamespace } from "@cloudflare/workers-types";

export interface Env {
  LICENSES: KVNamespace;
  APPSUMO_API_KEY: string;
  APPSUMO_CLIENT_ID: string;
  APPSUMO_CLIENT_SECRET: string;
  APPSUMO_REDIRECT_URI: string;
  TOKEN_PRIVATE_KEY: string;
  TOKEN_PUBLIC_KEY: string;
  ASSETS: Fetcher;
}

export interface KVLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface LicenseEvent {
  event: string;
  created_at: number;
  received_at: number;
  license_key: string;
  previous_key?: string;
  tier?: number;
  reason?: string;
}

export interface LicenseRecord {
  license_key: string;
  status: "inactive" | "active" | "deactivated";
  tier: number;
  updated_at: number;
  events: LicenseEvent[];
}
