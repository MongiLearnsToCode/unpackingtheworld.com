/**
 * One-line JSON logs with a `metric` field, so `wrangler tail` output can be
 * grepped and counted. Never include licence keys, tokens or pasted input.
 */
export function log(metric: string, fields: Record<string, string | number | boolean> = {}): void {
  console.log(JSON.stringify({ metric, ...fields }));
}

export function warn(metric: string, fields: Record<string, string | number | boolean> = {}): void {
  console.warn(JSON.stringify({ metric, ...fields }));
}
