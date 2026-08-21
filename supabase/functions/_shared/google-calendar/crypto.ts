/**
 * AES-GCM encryption for Google refresh tokens.
 * Key comes from GOOGLE_TOKEN_ENCRYPTION_KEY (32 bytes, base64).
 * Output format: base64(iv) + "." + base64(ciphertext)
 */

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("MISSING_ENCRYPTION_KEY");
  const keyBytes = b64ToBytes(raw);
  if (keyBytes.length !== 32) throw new Error("INVALID_ENCRYPTION_KEY");
  return await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptToken(plain: string): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plain),
    ),
  );
  return `${bytesToB64(iv)}.${bytesToB64(cipher)}`;
}

export async function decryptToken(payload: string): Promise<string> {
  const key = await getKey();
  const [ivB64, cipherB64] = payload.split(".");
  if (!ivB64 || !cipherB64) throw new Error("INVALID_CIPHERTEXT");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(ivB64) },
    key,
    b64ToBytes(cipherB64),
  );
  return new TextDecoder().decode(plain);
}

/** SHA-256 hex hash, used to store OAuth state values. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToB64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
