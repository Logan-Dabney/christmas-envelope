// Scrambles small JSON payloads into URL-safe text and back.
// Used by the reveal page (in the browser) and by the drawer (in Node).
//
// This is a seal, not a lock: it keeps names from being readable at a
// glance in a link or in the saved draw file, but anyone determined could
// unscramble it. That is the right level for a family gift exchange.

const KEY = 'north-pole-workshop-elves';

function scramble(bytes) {
  return bytes.map((byte, index) => byte ^ KEY.charCodeAt(index % KEY.length));
}

export function encodeToken(payload) {
  const bytes = scramble(new TextEncoder().encode(JSON.stringify(payload)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Returns the payload, or null when the text is not a valid token.
export function decodeToken(token) {
  try {
    const base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(scramble(bytes)));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}
