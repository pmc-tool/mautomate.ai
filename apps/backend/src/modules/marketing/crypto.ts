import crypto from "crypto"

/**
 * AES-256-GCM secret sealing for marketing social credentials / OAuth tokens.
 *
 * The symmetric key comes ONLY from `MARKETING_SECRET_KEY` (a base64-encoded
 * 32-byte key). If it is unset, sealing/opening THROW — we never silently fall
 * back to persisting plaintext.
 *
 * Sealed format: base64("iv:tag:ciphertext"), where the three parts are
 * themselves base64 and joined with ":". A fresh random 12-byte IV is used per
 * seal; the 16-byte GCM auth tag is stored alongside for verification on open.
 */

const ALGO = "aes-256-gcm"
const IV_BYTES = 12
const KEY_BYTES = 32

function loadKey(): Buffer {
  const raw = process.env.MARKETING_SECRET_KEY
  if (!raw) {
    throw new Error("MARKETING_SECRET_KEY not set")
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== KEY_BYTES) {
    throw new Error("MARKETING_SECRET_KEY must be a base64-encoded 32-byte key")
  }
  return key
}

/**
 * Encrypt `plain` and return a base64("iv:tag:ciphertext") envelope. Throws
 * when `MARKETING_SECRET_KEY` is unset — plaintext is NEVER persisted.
 */
export const sealSecret = (plain: string): string => {
  const key = loadKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv(ALGO, Uint8Array.from(key), Uint8Array.from(iv))
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
 * Reverse of `sealSecret`. Throws when `MARKETING_SECRET_KEY` is unset or when
 * the envelope is malformed / fails GCM authentication.
 */
export const openSecret = (sealed: string): string => {
  const key = loadKey()
  const envelope = Buffer.from(sealed, "base64").toString("utf8")
  const parts = envelope.split(":")
  if (parts.length !== 3) {
    throw new Error("Malformed sealed secret")
  }
  const iv = Buffer.from(parts[0], "base64")
  const tag = Buffer.from(parts[1], "base64")
  const ciphertext = Buffer.from(parts[2], "base64")
  const decipher = crypto.createDecipheriv(ALGO, Uint8Array.from(key), Uint8Array.from(iv))
  decipher.setAuthTag(Uint8Array.from(tag))
  const plain = Buffer.concat([
    Uint8Array.from(decipher.update(Uint8Array.from(ciphertext))),
    Uint8Array.from(decipher.final()),
  ])
  return plain.toString("utf8")
}
