// Cryptographic helpers for the Google Calendar OAuth flow.
// Refresh tokens are AES-GCM encrypted with GOOGLE_TOKEN_ENCRYPTION_KEY and are
// never logged, never returned to the browser and never stored in plaintext.

/** 32 random bytes (256 bits) of CSPRNG entropy, hex encoded. */
export function randomStateValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex digest — only the hash of the OAuth state is persisted. */
export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function encryptionKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!raw) throw new Error("missing_encryption_key");
  // Accept base64 (preferred, 32 bytes) or any string -> SHA-256 derived key.
  let keyBytes: Uint8Array;
  try {
    const decoded = base64ToBytes(raw.trim());
    keyBytes = decoded.length === 32
      ? decoded
      : new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  } catch {
    keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw)));
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** AES-GCM encrypt -> "base64(iv).base64(ciphertext)" */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  return `${bytesToBase64(iv)}.${bytesToBase64(cipher)}`;
}

export async function decryptToken(payload: string): Promise<string> {
  const [ivB64, dataB64] = payload.split(".");
  if (!ivB64 || !dataB64) throw new Error("invalid_encrypted_payload");
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(ivB64) },
    key,
    base64ToBytes(dataB64),
  );
  return new TextDecoder().decode(plain);
}
