/**
 * Hash routes that render the tool (or its legal pages) rather than the landing page.
 * Kept in one place so the client mount decision and the prerender script agree.
 */
export const TOOL_HASHES = ["#redeem", "#privacy", "#terms", "#refunds", "#faq"] as const;

export function isLandingRoute(pathname: string, hash: string): boolean {
  if (pathname !== "/") return false;
  if (hash.startsWith("#d=")) return false;
  return !(TOOL_HASHES as readonly string[]).includes(hash);
}

/** True when the first paint should be the marketing page. */
export function isLandingLocation(): boolean {
  return typeof location !== "undefined" && isLandingRoute(location.pathname, location.hash);
}
