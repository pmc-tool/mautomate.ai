import crypto from "crypto"

const MFA_KEY = () => {
  const k = process.env.AUTH_MFA_ENCRYPTION_KEY
  if (!k || k.length < 32) {
    throw new Error("AUTH_MFA_ENCRYPTION_KEY must be at least 32 characters")
  }
  return crypto.scryptSync(k, "mfa-encryption-salt", 32)
}

const BACKUP_CODE_COUNT = 10
const BACKUP_CODE_LENGTH = 8

/** RFC 4648 base32 encoding (no padding). */
function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  let out = ""
  let bits = 0
  let value = 0
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i]
    bits += 8
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31]
  }
  return out
}

/** RFC 4648 base32 decoding. */
function base32Decode(str: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const map = new Map<string, number>()
  for (let i = 0; i < alphabet.length; i++) map.set(alphabet[i], i)
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of str.toUpperCase()) {
    const v = map.get(ch)
    if (v === undefined) continue
    value = (value << 5) | v
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function hotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac("sha1", secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3]
  return String(code % Math.pow(10, digits)).padStart(digits, "0")
}

function totp(secret: Buffer, window = 0, step = 30): string {
  const counter = Math.floor(Date.now() / 1000 / step) + window
  return hotp(secret, counter)
}

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(16)
  const key = MFA_KEY()
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`
}

function decrypt(encoded: string): string {
  const [ivHex, tagHex, encHex] = encoded.split(":")
  const iv = Buffer.from(ivHex, "hex")
  const tag = Buffer.from(tagHex, "hex")
  const enc = Buffer.from(encHex, "hex")
  const key = MFA_KEY()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8")
}

function hashCode(code: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(code, salt, 32).toString("hex")
  return `${salt}:${hash}`
}

function verifyCodeHash(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  const computed = crypto.scryptSync(code, salt, 32).toString("hex")
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(computed))
}

export class MerchantMfaService {
  /** Generate a new TOTP secret, QR URI, and backup codes. Returns plaintext codes ONCE. */
  generateSetup(merchantId: string, email: string, tenantName: string) {
    const secretBytes = crypto.randomBytes(20)
    const secret = base32Encode(secretBytes)
    const issuer = process.env.MFA_ISSUER || "mAutomate"
    const label = encodeURIComponent(`${issuer}:${email}`)
    const qrUri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`
    const backupCodes = Array.from({ length: BACKUP_CODE_COUNT }, () =>
      crypto.randomBytes(BACKUP_CODE_LENGTH / 2).toString("hex").toUpperCase()
    )
    return {
      secret_encrypted: encrypt(secret),
      secret_plaintext_for_display: secret,
      qr_uri: qrUri,
      backup_codes_plaintext: backupCodes,
      backup_codes_hash: backupCodes.map(hashCode),
    }
  }

  /** Verify a TOTP code or backup code. */
  verify(secretEncrypted: string | null | undefined, backupHashes: string | null | undefined, code: string): boolean {
    if (!code) return false
    code = code.trim().replace(/\s/g, "").toUpperCase()
    if (!/^\d+$/.test(code) && code.length !== BACKUP_CODE_LENGTH) return false

    // TOTP codes are 6 digits; allow ±1 window
    if (/^\d{6}$/.test(code) && secretEncrypted) {
      const secret = base32Decode(decrypt(secretEncrypted))
      for (let w = -1; w <= 1; w++) {
        if (totp(secret, w) === code) return true
      }
    }

    // Backup codes
    if (backupHashes) {
      let hashes: string[]
      try {
        hashes = JSON.parse(backupHashes)
      } catch {
        return false
      }
      for (const h of hashes) {
        if (verifyCodeHash(code, h)) return true
      }
    }

    return false
  }

  /** Verify a setup/change code (TOTP only, no backup codes). */
  verifyTotp(secretEncrypted: string, code: string): boolean {
    if (!/^\d{6}$/.test(code)) return false
    const secret = base32Decode(decrypt(secretEncrypted))
    for (let w = -1; w <= 1; w++) {
      if (totp(secret, w) === code) return true
    }
    return false
  }
}

export const merchantMfaService = new MerchantMfaService()
