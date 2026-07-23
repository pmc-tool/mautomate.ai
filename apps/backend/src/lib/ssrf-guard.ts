import { MedusaError } from "@medusajs/framework/utils"
import dns from "dns/promises"
import net from "net"

/**
 * ssrf-guard — SECURITY INVARIANT: a client-supplied URL that the server (or a
 * downstream provider on the server's behalf) will FETCH must never be allowed
 * to reach an internal / private / loopback / link-local / cloud-metadata
 * address. A bare `startsWith("http")` check does not stop
 * `http://169.254.169.254/...`, `http://127.0.0.1:3010`, `http://10.x`, etc.,
 * which turns any "give us an image URL" field into a server-side request
 * forgery + a blind status oracle for internal port probing.
 *
 * This is the single shared validator used by every route that fetches a
 * client-provided image URL (ads image/video, blog image). It:
 *   - accepts ONLY http/https,
 *   - resolves the host (literal IP or DNS) and rejects any address in a
 *     private / loopback / link-local / CGNAT / metadata range (IPv4 + IPv6,
 *     incl. IPv4-mapped IPv6),
 *   - rejects embedded credentials and non-standard ports commonly used by
 *     internal services is out of scope here (range check is the guarantee).
 *
 * Fail-closed: anything that does not clearly resolve to a PUBLIC address is
 * rejected with a generic INVALID_DATA error (no upstream status is echoed).
 */

/** True when `ip` (a valid IPv4/IPv6 literal) is NOT a public, routable host. */
export function isBlockedIp(ip: string): boolean {
  const v = net.isIP(ip)
  if (v === 4) {
    return isBlockedIpv4(ip)
  }
  if (v === 6) {
    return isBlockedIpv6(ip)
  }
  // Not a parseable IP -> treat as blocked (fail-closed).
  return true
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p))
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts
  // 0.0.0.0/8 (incl. 0.0.0.0), 10/8, 127/8 loopback, 169.254/16 link-local +
  // metadata, 172.16/12, 192.168/16, 100.64/10 CGNAT, 192.0.0/24, 198.18/15
  // benchmarking, 255.255.255.255 broadcast, and all multicast (224/4).
  if (a === 0) return true
  if (a === 10) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 192 && b === 0 && parts[2] === 0) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true // multicast + reserved
  return false
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  // Unspecified / loopback.
  if (lower === "::" || lower === "::1") return true
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible -> re-check as IPv4.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/) || lower.match(/^::(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isBlockedIpv4(mapped[1])
  // Unique-local fc00::/7 (fc.. / fd..) and link-local fe80::/10.
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true
  }
  return false
}

/**
 * Validate a client-supplied fetchable URL. Returns the URL unchanged when it
 * is safe; throws MedusaError(INVALID_DATA) otherwise. Resolves DNS, so pass
 * the SAME url to the fetch immediately after (a determined DNS-rebind attacker
 * could still swap the record between this check and the fetch — the fetch site
 * `toInlinePart` re-validates for exactly that reason).
 */
export async function assertPublicHttpUrl(raw: string): Promise<string> {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That image URL is not valid.")
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Only http/https image URLs are allowed.")
  }
  if (u.username || u.password) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "That image URL is not allowed.")
  }

  const host = u.hostname.replace(/^\[|\]$/g, "") // strip IPv6 brackets
  let addresses: string[]
  if (net.isIP(host)) {
    addresses = [host]
  } else {
    let resolved: { address: string }[]
    try {
      resolved = await dns.lookup(host, { all: true })
    } catch {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "That image URL could not be resolved.")
    }
    addresses = resolved.map((r) => r.address)
    if (!addresses.length) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "That image URL could not be resolved.")
    }
  }
  // Fail-closed: EVERY resolved address must be public.
  for (const addr of addresses) {
    if (isBlockedIp(addr)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "That image URL points to a disallowed address."
      )
    }
  }
  return raw
}

/** Content-types we accept for an image fetch (prefix match on the major type). */
export function isAllowedImageContentType(contentType: string | null | undefined): boolean {
  if (!contentType) return false
  const ct = contentType.split(";")[0].trim().toLowerCase()
  return ct.startsWith("image/")
}
