/**
 * crypto.ts — client-side AES-256-GCM helpers for BotForge.
 *
 * A symmetric key is derived from a fixed application passphrase using
 * PBKDF2-SHA-256 so that sensitive values (e.g. OpenAI API keys) are
 * obfuscated before being stored in localStorage or sent to the DB.
 *
 * NOTE: Because the derivation passphrase lives in the JS bundle this
 * provides obfuscation-at-rest, not cryptographic confidentiality against
 * a determined attacker who can read the bundle.  Server-side encryption
 * (e.g. Supabase Vault) should be used for production-grade key storage.
 */

const PASSPHRASE = "botforge-v1-aes256gcm";
const SALT = new TextEncoder().encode("botforge-pbkdf2-salt-v1");
const PBKDF2_ITERATIONS = 100_000;

/** Derive an AES-256-GCM CryptoKey from the bundle passphrase. */
async function deriveKey(): Promise<CryptoKey> {
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PASSPHRASE),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: SALT,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
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
export async function encryptKey(plaintext: string): Promise<string> {
  const key = await deriveKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  // Concatenate IV + ciphertext into a single buffer
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);

  // Encode as Base64 for safe string storage
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a Base64-encoded AES-256-GCM ciphertext produced by encryptKey().
 * Returns the original plaintext string.
 * Throws if the ciphertext is invalid or tampered.
 */
export async function decryptKey(encrypted: string): Promise<string> {
  const key = await deriveKey();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  if (combined.length <= 12) {
    throw new Error("Invalid ciphertext: too short.");
  }

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
