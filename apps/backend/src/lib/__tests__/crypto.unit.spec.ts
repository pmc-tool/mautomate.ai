import crypto from "crypto"
import {
  assertKey,
  generateDataKey,
  loadKek,
  openWithKey,
  sealWithKey,
  unwrapDataKey,
  wrapDataKey,
} from "../crypto"

/**
 * Brand2Door Phase 0 secret-encryption CI gate.
 *
 * These assertions fail the build if the envelope primitives ever leak a secret
 * in plaintext, accept the wrong key, or silently fall back to an unencrypted
 * value. They are the enforceable half of "tenant secrets are never stored
 * plaintext".
 */
describe("platform crypto — envelope encryption", () => {
  const KEK = generateDataKey()
  const SECRET = "sk_live_super_sensitive_stripe_key_1234567890"

  it("round-trips a value with a 32-byte key", () => {
    const sealed = sealWithKey(KEK, SECRET)
    expect(openWithKey(KEK, sealed)).toBe(SECRET)
  })

  it("NEVER contains the plaintext in the sealed envelope", () => {
    const sealed = sealWithKey(KEK, SECRET)
    // the ciphertext (and any decoding of it) must not reveal the secret
    expect(sealed).not.toContain(SECRET)
    expect(sealed).not.toContain("sk_live")
    const decoded = Buffer.from(sealed, "base64").toString("utf8")
    expect(decoded).not.toContain(SECRET)
    expect(decoded).not.toContain("sk_live")
  })

  it("produces a fresh IV per seal (no deterministic ciphertext reuse)", () => {
    expect(sealWithKey(KEK, SECRET)).not.toBe(sealWithKey(KEK, SECRET))
  })

  it("rejects opening with a different key", () => {
    const sealed = sealWithKey(KEK, SECRET)
    expect(() => openWithKey(generateDataKey(), sealed)).toThrow()
  })

  it("rejects a tampered envelope (GCM auth)", () => {
    const sealed = sealWithKey(KEK, SECRET)
    const raw = Buffer.from(sealed, "base64").toString("utf8").split(":")
    const ct = Buffer.from(raw[2], "base64")
    ct[0] = ct[0] ^ 0xff
    raw[2] = ct.toString("base64")
    const tampered = Buffer.from(raw.join(":"), "utf8").toString("base64")
    expect(() => openWithKey(KEK, tampered)).toThrow()
  })

  it("enforces a 32-byte key length", () => {
    expect(() => assertKey(crypto.randomBytes(16))).toThrow()
    expect(() => sealWithKey(crypto.randomBytes(16), SECRET)).toThrow()
  })

  it("wraps/unwraps a DEK with the KEK without exposing it", () => {
    const dek = generateDataKey()
    const wrapped = wrapDataKey(dek, KEK)
    expect(wrapped).not.toContain(dek.toString("base64"))
    expect(unwrapDataKey(wrapped, KEK).equals(Uint8Array.from(dek))).toBe(true)
  })

  describe("loadKek", () => {
    const prev = process.env.PLATFORM_KEK
    afterEach(() => {
      if (prev === undefined) {
        delete process.env.PLATFORM_KEK
      } else {
        process.env.PLATFORM_KEK = prev
      }
    })

    it("throws when PLATFORM_KEK is unset (no plaintext fallback)", () => {
      delete process.env.PLATFORM_KEK
      expect(() => loadKek()).toThrow(/PLATFORM_KEK not set/)
    })

    it("throws when PLATFORM_KEK is the wrong length", () => {
      process.env.PLATFORM_KEK = crypto.randomBytes(16).toString("base64")
      expect(() => loadKek()).toThrow()
    })

    it("loads a valid 32-byte base64 key", () => {
      const key = generateDataKey()
      process.env.PLATFORM_KEK = key.toString("base64")
      expect(loadKek().equals(Uint8Array.from(key))).toBe(true)
    })
  })
})
