import { PLATFORM_MODULE } from "../../../modules/platform"

const DEFAULTS = [
  { key: "aurora", name: "Aurora", accent_color: "#0e7490", description: "Calm teal — the default.", sort: 0 },
  { key: "sunset", name: "Sunset", accent_color: "#ea580c", description: "Warm orange.", sort: 1 },
  { key: "forest", name: "Forest", accent_color: "#16794c", description: "Fresh green.", sort: 2 },
  { key: "grape", name: "Grape", accent_color: "#7c3aed", description: "Bold violet.", sort: 3 },
  { key: "mono", name: "Mono", accent_color: "#334155", description: "Minimal slate.", sort: 4 },
]

export async function ensureThemes(scope: any) {
  const svc: any = scope.resolve(PLATFORM_MODULE)
  const rows = await svc.listStorefrontThemes({})
  if (!rows?.length) await svc.createStorefrontThemes(DEFAULTS)
}

export async function themeAccent(scope: any, key?: string): Promise<string> {
  if (!key) return "#0e7490"
  const svc: any = scope.resolve(PLATFORM_MODULE)
  const [t] = await svc.listStorefrontThemes({ key }, { take: 1 })
  return t?.accent_color || "#0e7490"
}
