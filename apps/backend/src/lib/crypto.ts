import crypto from "crypto"

/**
 * Platform envelope-encryption primitives (mAutomate Phase 0).
 *
 * This generalises the marketing module's AES-256-GCM sealing into a
 * key-parameterised form so the platform can do TRUE envelope encryption:
 *
 *   KEK  — a single master key from `PLATFORM_KEK` (base64 32-byte). It NEVER
 *          encrypts tenant data directly; it only wraps per-tenant data keys.
 *   DEK  — a per-tenant 32-byte data key, generated at random, stored only in
 *          its KEK-wrapped form (see `tenant_key`). Tenant secrets are sealed
 *          with the DEK.
 *
 * Rotation: wrapping the DEK (not the data) means the KEK can be rotated by
 * re-wrapping each tenant's DEK, and a tenant's DEK can be rotated by
 * re-sealing its secrets — both without a plaintext-at-rest window. The
 * `key_version` column on `tenant_key` tracks which generation wrapped a DEK.
 *
 * Sealed format: base64("iv:tag:ciphertext"), each part base64, joined by ":".
 * Fresh random 12-byte IV per seal; 16-byte GCM auth tag stored for verify.
 *
 * NOTHING here ever falls back to plaintext: a missing/short key THROWS.
 */

const ALGO = "aes-256-gcm"
const IV_BYTES = 12
const KEY_BYTES = 32

/** Validate a raw symmetric key is exactly 32 bytes. */
export const assertKey = (key: Buffer, label = "key"): Buffer => {
  if (key.length !== KEY_BYTES) {
    throw new Error(`${label} must be exactly ${KEY_BYTES} bytes`)
  }
  return key
}

/**
 * Load the master key-encryption-key (KEK) from `PLATFORM_KEK`
 * (base64-encoded 32 bytes). Throws when unset or the wrong length — the
 * platform refuses to run its secret store without a real master key.
 */
export const loadKek = (): Buffer => {
  const raw = process.env.PLATFORM_KEK
  if (!raw) {
    throw new Error("PLATFORM_KEK not set")
  }
  return assertKey(Buffer.from(raw, "base64"), "PLATFORM_KEK")
}

/** Generate a fresh random 32-byte data key (DEK). */
export const generateDataKey = (): Buffer => crypto.randomBytes(KEY_BYTES)

/**
 * Encrypt `plain` with `key` and return a base64("iv:tag:ciphertext") envelope.
 */
export const sealWithKey = (key: Buffer, plain: string): string => {
  assertKey(key)
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(
    ALGO,
    Uint8Array.from(key),
    Uint8Array.from(iv)
  )
  const ciphertext = Buffer.concat([
    Uint8Array.from(cipher.update(plain, "utf8")),
    Uint8Array.from(cipher.final()),
  ])
  const tag = cipher.getAuthTag()
  const envelope = [
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
  return Buffer.from(envelope, "utf8").toString("base64")
}

/**
 * Reverse of `sealWithKey`. Throws when the envelope is malformed or fails GCM
 * authentication (wrong key, tampered ciphertext/tag).
 */
export const openWithKey = (key: Buffer, sealed: string): string => {
  assertKey(key)
  const envelope = Buffer.from(sealed, "base64").toString("utf8")
  const parts = envelope.split(":")
  if (parts.length !== 3) {
    throw new Error("Malformed sealed secret")
  }
  const iv = Buffer.from(parts[0], "base64")
  const tag = Buffer.from(parts[1], "base64")
  const ciphertext = Buffer.from(parts[2], "base64")
  const decipher = crypto.createDecipheriv(
    ALGO,
    Uint8Array.from(key),
    Uint8Array.from(iv)
  )
  decipher.setAuthTag(Uint8Array.from(tag))
  const plain = Buffer.concat([
    Uint8Array.from(decipher.update(Uint8Array.from(ciphertext))),
    Uint8Array.from(decipher.final()),
  ])
  return plain.toString("utf8")
}

/** Wrap a DEK with the KEK for at-rest storage. */
export const wrapDataKey = (dek: Buffer, kek: Buffer = loadKek()): string =>
  sealWithKey(kek, dek.toString("base64"))

/** Unwrap a KEK-wrapped DEK back into a raw 32-byte key. */
export const unwrapDataKey = (wrapped: string, kek: Buffer = loadKek()): Buffer =>
  assertKey(Buffer.from(openWithKey(kek, wrapped), "base64"), "unwrapped DEK")
