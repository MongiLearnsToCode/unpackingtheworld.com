/** Share links keep the input in the URL fragment, which is never sent to a server. */
export function encodeShare(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(fragment: string): string {
  const match = fragment.match(/^#d=([A-Za-z0-9_-]+)$/);
  if (!match) return "";
  try {
    const binary = atob(match[1].replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

export function shareUrl(text: string, location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}#d=${encodeShare(text)}`;
}
