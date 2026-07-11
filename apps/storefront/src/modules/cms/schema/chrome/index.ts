import type { BlockSchema } from "../types"
import { headerSchema } from "./header"
import { topbarSchema } from "./topbar"
import { footerSchema } from "./footer"
import { themeSchema } from "./theme"

export { headerSchema } from "./header"
export { topbarSchema } from "./topbar"
export { footerSchema } from "./footer"
export { themeSchema } from "./theme"

/** Global chrome schemas keyed by their block type. */
export const CHROME_SCHEMAS = {
  header: headerSchema,
  topbar: topbarSchema,
  footer: footerSchema,
  theme: themeSchema,
} as const

export type ChromeKey = keyof typeof CHROME_SCHEMAS

/** Resolve a chrome schema by its key, or undefined when unknown. */
export function getChromeSchema(key: string): BlockSchema | undefined {
  return CHROME_SCHEMAS[key as ChromeKey]
}
