import type { Metadata } from "next"
import { headers } from "next/headers"
import ChunkGuard from "@modules/common/components/ChunkGuard"
import "../styles/globals.css"
import { getActiveTheme } from "@themes/registry"
import { buildThemeVars, legacyThemeColor } from "@modules/cms/render/theme-vars"
import { getCmsSettings } from "@lib/data/cms"
import { getAnalyticsWebsiteId } from "@lib/data/analytics"
import { getMetaPixelId } from "@lib/data/ads"

export const metadata: Metadata = {
  title: "mAutomate",
  description: "mAutomate storefront",
}

// The root layout resolves the active theme + CMS settings PER TENANT by reading
// request headers (x-tenant-theme) and the tenant's backend on every route.
// That is inherently per-request, so the whole app must render dynamically:
// static prerendering the shell crashes Next 15 static export with a
// workUnitAsyncStorage invariant. Force dynamic once, here, for all routes.
export const dynamic = "force-dynamic"

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
  const [activeTheme, settings, umamiWebsiteId, metaPixelId] =
    await Promise.all([
      getActiveTheme().catch(() => null),
      getCmsSettings().catch(() => null),
      getAnalyticsWebsiteId().catch(() => null),
      getMetaPixelId().catch(() => null),
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

  // A Meta pixel id is strictly numeric; enforcing that here means nothing
  // non-numeric can ever be interpolated into the inline script below.
  const pixelId = metaPixelId?.replace(/[^0-9]/g, "") || null

  // PWA (Add to Home Screen): the browser-chrome theme color is the store's own
  // accent (falls back to a neutral so it is never empty). The manifest + icons
  // are served per-tenant from the origin root (see app/manifest.webmanifest +
  // app/pwa-icon) so an installed store carries THIS shop's name/color/icon.
  const tenantAccent = await headers()
    .then((h) => h.get("x-tenant-accent"))
    .catch(() => null)
  // U7 dual-read: a store on the explicit null-inherit token shape stores
  // `primary: null` for "inherit" — legacyThemeColor maps that back to the
  // exact bytes the sentinel wire carried, so this line's output is unchanged.
  const pwaThemeColor =
    tenantAccent || legacyThemeColor(settings?.theme, "primary") || "#111111"

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
        {pixelId && (
          // Meta base pixel (PageView only). Purchase fires SERVER-SIDE via the
          // Conversions API subscriber — browser and server must not both send
          // Purchase without a shared event_id, so the browser deliberately
          // stays at PageView. The id is tenant-resolved, digits-only enforced
          // (a pixel id is numeric — anything else never reaches the markup),
          // and public by design.
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`,
            }}
          />
        )}
        {activeTheme?.favicon && (
          <link rel="icon" href={activeTheme.favicon} type="image/webp" />
        )}
        {/* PWA: per-tenant manifest + installability meta. The manifest, icons
            and service worker are all served from the origin root and resolve
            the current tenant's branding server-side (see middleware bypass). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content={pwaThemeColor} />
        <link rel="apple-touch-icon" href="/pwa-icon?size=180" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
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
        {pixelId && (
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              alt=""
              src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        )}
        {children}
      </body>
    </html>
  )
}
