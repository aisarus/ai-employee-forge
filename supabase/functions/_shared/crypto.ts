/**
 * crypto.ts — AES-256-GCM helpers for Supabase Edge Functions (Deno).
 *
 * Identical algorithm to src/lib/crypto.ts so client-encrypted values are
 * readable by edge functions and vice-versa.
 *
 * A symmetric key is derived from a fixed application passphrase using
 * PBKDF2-SHA-256.  This provides obfuscation-at-rest; for full cryptographic
 * confidentiality migrate to Supabase Vault.
 */

const PASSPHRASE = "botforge-v1-aes256gcm";
const SALT = new TextEncoder().encode("botforge-pbkdf2-salt-v1");
const PBKDF2_ITERATIONS = 100_000;

async function deriveKey(): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PASSPHRASE),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a Base64-encoded string of [12-byte IV || ciphertext].
 */
export async function encryptValue(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a Base64-encoded AES-256-GCM ciphertext produced by encryptValue().
 * Returns the original plaintext string, or throws on invalid/tampered data.
 */
export async function decryptValue(encrypted: string): Promise<string> {
  const key = await deriveKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  if (combined.length <= 12) throw new Error("Invalid ciphertext: too short.");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: combined.slice(0, 12) },
    key,
    combined.slice(12),
  );
  return new TextDecoder().decode(decrypted);
}

/**
 * Try to decrypt a value; if decryption fails (legacy plaintext), return as-is.
 */
export async function tryDecrypt(value: string): Promise<string> {
  try {
    return await decryptValue(value);
  } catch {
    return value; // legacy plaintext row
  }
}
