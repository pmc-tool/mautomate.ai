/**
 * fetch-url — turn a merchant-supplied web page into embeddable plain text.
 *
 * The training pipeline (`knowledge/rag`) embeds a source's literal text, so a
 * `url` source is only worth training on if somebody actually fetched the page.
 * That is this file's whole job: fetch the URL, strip the markup, hand back the
 * readable text so the caller can store it as the source's `content`.
 *
 * SSRF: the URL comes from an authenticated merchant, but a merchant is not a
 * trusted operator — an unguarded server-side fetch would happily read the
 * cloud metadata endpoint or anything on the private network. So, fail closed:
 *   - http/https only (no file:, gopher:, data:, …),
 *   - the hostname is resolved and EVERY resolved address must be a public
 *     unicast address (blocks localhost, 10/8, 172.16/12, 192.168/16, 169.254/16
 *     incl. the metadata IP, ::1, fc00::/7, …),
 *   - redirects are followed MANUALLY so each hop is re-validated (a public URL
 *     that 302s to 169.254.169.254 is the classic bypass),
 *   - hard caps on time, redirect hops, and bytes read.
 */

import dns from "node:dns/promises"
import net from "node:net"

/** Total wall-clock budget for one fetch, including redirects. */
const TIMEOUT_MS = 12_000
const MAX_REDIRECTS = 3
/** Read cap. Anything past this is truncated, never buffered. */
const MAX_BYTES = 2_000_000
/** Embedding cap: chunking beyond this adds cost, not answers. */
const MAX_TEXT_CHARS = 100_000

/** True when an IP literal is anything other than a public unicast address. */
const isPrivateAddress = (ip: string): boolean => {
  const v = net.isIP(ip)
  if (v === 4) {
    const p = ip.split(".").map((n) => parseInt(n, 10))
    if (p.length !== 4 || p.some((n) => !Number.isInteger(n))) {
      return true
    }
    const [a, b] = p
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast + reserved
    return false
  }
  if (v === 6) {
    const ip6 = ip.toLowerCase().replace(/^\[|\]$/g, "")
    if (ip6 === "::" || ip6 === "::1") return true
    if (ip6.startsWith("fe80")) return true // link-local
    if (/^f[cd]/.test(ip6)) return true // unique-local fc00::/7
    // IPv4-mapped (::ffff:169.254.169.254) — validate the embedded v4.
    const mapped = ip6.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1])
    return false
  }
  // Not an IP literal at all: treat as unsafe.
  return true
}

/**
 * Assert a URL is safe to fetch from the server. Throws with a merchant-readable
 * message otherwise. Resolves the hostname and rejects if ANY answer is private —
 * a DNS name that resolves to both a public and a private address is rejected.
 */
const assertPublicUrl = async (raw: string): Promise<URL> => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("That does not look like a valid URL.")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs can be imported.")
  }

  const host = url.hostname.replace(/^\[|\]$/g, "")

  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      throw new Error("That address is not reachable from the public internet.")
    }
    return url
  }

  let addresses: { address: string }[]
  try {
    addresses = await dns.lookup(host, { all: true })
  } catch {
    throw new Error(`The host ${host} could not be resolved.`)
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new Error("That address is not reachable from the public internet.")
  }
  return url
}

/** Strip markup, scripts, styles and entities down to readable page text. */
export const htmlToText = (html: string): string => {
  const withoutHead = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")

  // Block-level tags become line breaks so sentences do not run together.
  const withBreaks = withoutHead
    .replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")

  const decoded = withBreaks
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => {
      const n = parseInt(code, 10)
      return Number.isFinite(n) && n > 31 && n < 0x10ffff
        ? String.fromCodePoint(n)
        : " "
    })

  return decoded
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export type FetchedPage = {
  /** The URL actually read (after redirects). */
  url: string
  title: string | null
  text: string
}

/**
 * Fetch a public web page and return its readable text. Throws a
 * merchant-readable Error on a blocked URL, a transport failure, a non-HTML
 * response, or a page with no extractable text.
 */
export const fetchUrlText = async (raw: string): Promise<FetchedPage> => {
  const deadline = Date.now() + TIMEOUT_MS
  let current = await assertPublicUrl(raw.trim())

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      throw new Error("The page took too long to respond.")
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), remaining)

    let res: Response
    try {
      res = await fetch(current.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Identify honestly; some sites 403 an empty UA.
          "user-agent": "mAutomateBot/1.0 (+https://mautomate.ai)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      })
    } catch {
      clearTimeout(timer)
      throw new Error("The page could not be fetched. Check the URL and try again.")
    }
    clearTimeout(timer)

    // Re-validate every redirect target: a public URL may redirect inward.
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location")
      if (!location) {
        throw new Error("The page redirected without a destination.")
      }
      if (hop === MAX_REDIRECTS) {
        throw new Error("The page redirected too many times.")
      }
      current = await assertPublicUrl(new URL(location, current).toString())
      continue
    }

    if (!res.ok) {
      throw new Error(`The page responded with HTTP ${res.status}.`)
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase()
    const isHtml = contentType.includes("html") || contentType.includes("xml")
    const isText = contentType.includes("text/plain")
    if (contentType && !isHtml && !isText) {
      throw new Error(
        "Only web pages can be imported. That URL returned " +
          `${contentType.split(";")[0]}.`
      )
    }

    const raw_body = await res
      .arrayBuffer()
      .then((buf) =>
        Buffer.from(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf).toString(
          "utf8"
        )
      )
      .catch(() => "")

    const title =
      raw_body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null

    const text = (isText ? raw_body : htmlToText(raw_body)).slice(0, MAX_TEXT_CHARS)
    if (!text) {
      throw new Error("No readable text was found on that page.")
    }

    return {
      url: current.toString(),
      title: title ? htmlToText(title).slice(0, 200) : null,
      text,
    }
  }

  throw new Error("The page redirected too many times.")
}
