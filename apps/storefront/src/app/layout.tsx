import type { Metadata } from "next"
import ChunkGuard from "@modules/common/components/ChunkGuard"
import "../styles/globals.css"
import { getActiveTheme } from "@themes/registry"
import { buildThemeVars } from "@modules/cms/render/theme-vars"
import { getCmsSettings } from "@lib/data/cms"
import { getAnalyticsWebsiteId } from "@lib/data/analytics"

export const metadata: Metadata = {
  title: "mAutomate",
  description: "mAutomate storefront",
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Resolve the ACTIVE theme and the store's CMS settings from the SAME tenant
  // resolution (multi-tenant: getActiveTheme reads x-tenant-theme / the tenant's
  // own active_theme; getCmsSettings reads the tenant's own backend). Single
  // tenant (Forever Finds) resolves its global CMS settings unchanged. Both are
  // best-effort — a fetch failure must never break the shell.
  const [activeTheme, settings, umamiWebsiteId] = await Promise.all([
    getActiveTheme().catch(() => null),
    getCmsSettings().catch(() => null),
    getAnalyticsWebsiteId().catch(() => null),
  ])

  // Compile the theme color/font custom properties (--ff-*) via the SAME helper
  // the editor canvas uses: the active theme's manifest tokens are the base
  // palette; the owner's CMS `theme` overrides layer on top only where they
  // customized. Emitted as a :root{--ff-*} <style> AFTER the theme stylesheets
  // (so owner customizations win the specificity tie) and set on the ROOT
  // layout, so body-scoped theme CSS + admin color/font customization apply on
  // EVERY page (store, PDP, cart, category, account) — not only the home/slug
  // pages that previously self-wrapped in the theme body className.
  const themeVars = buildThemeVars(settings?.theme, activeTheme?.tokens)

  return (
    <html lang="en">
      <head>
        {umamiWebsiteId && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            defer
            src="/umami/script.js"
            data-website-id={umamiWebsiteId}
            data-host-url="/umami"
          />
        )}
        {activeTheme?.favicon && (
          <link rel="icon" href={activeTheme.favicon} type="image/webp" />
        )}
        {activeTheme?.stylesheets?.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
        <style
          id="ff-theme-vars"
          dangerouslySetInnerHTML={{ __html: themeVars }}
        />
      </head>
      <body
        data-theme={activeTheme?.id}
        className={activeTheme?.bodyClassName ?? "learts-theme"}
      >
        <ChunkGuard />
        {children}
      </body>
    </html>
  )
}
