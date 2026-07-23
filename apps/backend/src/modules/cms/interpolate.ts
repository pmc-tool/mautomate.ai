/**
 * Replace {{ token }} placeholders in CMS content with real values at SERVE time.
 *
 * The platform seeds copy with tokens like {{store_name}} but never interpolated
 * them, so pages literally rendered "About {{store_name}}". This walks the
 * published snapshot (strings, arrays, nested objects) and substitutes each token
 * — so every page, for every store, current or future, renders the real name
 * without any data migration. Case/whitespace tolerant: {{store_name}},
 * {{ store_name }}, {{Store_Name}} all match.
 */
export function interpolateTokens(
  value: unknown,
  tokens: Record<string, string>
): unknown {
  if (typeof value === "string") {
    let s = value
    for (const [k, v] of Object.entries(tokens)) {
      if (!v) continue
      s = s.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v)
    }
    return s
  }
  if (Array.isArray(value)) {
    return value.map((v) => interpolateTokens(v, tokens))
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>)) {
      out[k] = interpolateTokens((value as Record<string, unknown>)[k], tokens)
    }
    return out
  }
  return value
}
