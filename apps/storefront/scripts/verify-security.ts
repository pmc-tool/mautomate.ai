/**
 * Dependency-free security checks for the CMS hardening surface.
 *
 * No test framework is installed in the storefront, so this runs the two
 * security-critical pure functions directly under Node's native type stripping:
 *
 *   node --experimental-strip-types apps/storefront/scripts/verify-security.ts
 *
 * (or `npm run verify:security` from apps/storefront). Exits non-zero on any
 * failed assertion so it can gate CI later.
 */

// Set the secret BEFORE importing secret.ts consumers read process.env lazily.
process.env.CMS_PREVIEW_SECRET = "test-preview-secret-value"

import crypto from "crypto"
import { sanitizeHtml } from "../src/lib/util/sanitize-html.ts"
import { isValidEditorKey } from "../src/lib/util/secret.ts"

let passed = 0
let failed = 0

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++
  } else {
    failed++
    console.error(`  FAIL: ${name}`)
  }
}

/* --------------------------- sanitizeHtml --------------------------- */

console.log("sanitizeHtml:")

const noScript = sanitizeHtml('<p>hi</p><script>alert(1)</script>')
check("removes <script> block", !/script|alert/i.test(noScript))

const noHandler = sanitizeHtml('<img src="x" onerror="alert(1)">')
check("strips inline on* handler (quoted)", !/onerror/i.test(noHandler))

const noHandlerUnquoted = sanitizeHtml('<img src=x onerror=alert(1)>')
check("strips inline on* handler (unquoted)", !/onerror/i.test(noHandlerUnquoted))

const jsHref = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
check("neutralizes javascript: href", !/javascript:/i.test(jsHref) && /href="#"/.test(jsHref))

const jsEntityHref = sanitizeHtml('<a href="jav&#x09;ascript:alert(1)">x</a>')
check("neutralizes entity-obfuscated javascript: href", !/alert/i.test(jsEntityHref))

const svgStripped = sanitizeHtml('<svg><animate onbegin="alert(1)"/></svg>text')
check("drops non-allowlisted tags (svg)", !/<svg|<animate|onbegin/i.test(svgStripped) && /text/.test(svgStripped))

const iframeStripped = sanitizeHtml('<iframe src="//evil"></iframe><p>ok</p>')
check("drops iframe, keeps allowed <p>", !/iframe/i.test(iframeStripped) && /<p>ok<\/p>/.test(iframeStripped))

const keepsFormatting = sanitizeHtml('<h2>Title</h2><p><strong>bold</strong> <a href="/safe">link</a></p>')
check(
  "keeps allowlisted formatting + safe links",
  /<h2>Title<\/h2>/.test(keepsFormatting) &&
    /<strong>bold<\/strong>/.test(keepsFormatting) &&
    /href="\/safe"/.test(keepsFormatting)
)

check("empty / non-string input returns ''", sanitizeHtml("" as string) === "" && sanitizeHtml(undefined as unknown as string) === "")

// --- inline style allow-list (rich-text toolbar: color / font-size / align) ---

const keepsColor = sanitizeHtml('<span style="color: rgb(1, 2, 3)">x</span>')
check("keeps allow-listed color style", /style="color: rgb\(1, 2, 3\)"/.test(keepsColor))

const keepsSizeAlign = sanitizeHtml('<p style="text-align: center; font-size: large">x</p>')
check(
  "keeps text-align + font-size styles",
  /text-align: center/.test(keepsSizeAlign) && /font-size: large/.test(keepsSizeAlign)
)

const dropsProp = sanitizeHtml('<span style="color: red; position: fixed; top: 0">x</span>')
check(
  "drops non-allow-listed style props, keeps allowed",
  /color: red/.test(dropsProp) && !/position|fixed|top/i.test(dropsProp)
)

const dropsUrlValue = sanitizeHtml('<span style="color: url(javascript:alert(1))">x</span>')
check("rejects url()/javascript: style value", !/url|javascript|alert/i.test(dropsUrlValue))

const dropsExpression = sanitizeHtml('<div style="color: expression(alert(1))">x</div>')
check("rejects expression() style value", !/expression|alert/i.test(dropsExpression))

const dropsEmptyStyle = sanitizeHtml('<p style="position: absolute">x</p>')
check("drops style attribute entirely when nothing survives", !/style=/i.test(dropsEmptyStyle))

const dropsEntityStyle = sanitizeHtml('<span style="color: expr&#x65;ssion(x)">x</span>')
check("rejects entity-obfuscated style value", !/expression|expr|style=/i.test(dropsEntityStyle))

/* -------------------------- isValidEditorKey ------------------------ */

console.log("isValidEditorKey:")

const secret = process.env.CMS_PREVIEW_SECRET!

function mintToken(ttlMs: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + ttlMs })).toString("base64url")
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${sig}`
}

check("rejects empty key", !isValidEditorKey(""))
check("rejects null key", !isValidEditorKey(null))
check("rejects garbage token", !isValidEditorKey("not.a.real.token"))

const expiredToken = mintToken(-1000)
check("rejects expired token", !isValidEditorKey(expiredToken))

const validToken = mintToken(60_000)
check("accepts valid unexpired token", isValidEditorKey(validToken))

const forgedPayload = Buffer.from(JSON.stringify({ exp: Date.now() + 60_000 })).toString("base64url")
check("rejects token with forged signature", !isValidEditorKey(`${forgedPayload}.deadbeef`))

// Raw-secret path: allowed in dev, denied in production.
const prevEnv = process.env.NODE_ENV
process.env.NODE_ENV = "development"
check("dev: raw secret accepted", isValidEditorKey(secret))
process.env.NODE_ENV = "production"
check("prod: raw secret DENIED (must use expiring token)", !isValidEditorKey(secret))
check("prod: expiring token still accepted", isValidEditorKey(mintToken(60_000)))
process.env.NODE_ENV = prevEnv

/* ------------------------------- report ----------------------------- */

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
}
