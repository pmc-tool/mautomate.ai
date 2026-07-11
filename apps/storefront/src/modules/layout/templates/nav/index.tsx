import { retrieveCart } from "@lib/data/cart"
import { listCategories } from "@lib/data/categories"
import { getCmsSettings, resolveActiveCmsLocale } from "@lib/data/cms"
import { getActiveTheme } from "@themes/registry"
import LeartsHeader from "@modules/layout/components/learts-header"

export default async function Nav() {
  const [cart, categories, settings, locale, activeTheme] = await Promise.all([
    retrieveCart().catch(() => null),
    listCategories().catch(() => []),
    getCmsSettings().catch(() => null),
    resolveActiveCmsLocale().catch(() => "en" as const),
    getActiveTheme(),
  ])

  const cartCount =
    cart?.items?.reduce((acc, item) => acc + item.quantity, 0) ?? 0

  // The active theme MAY provide bespoke chrome; otherwise fall back to the
  // Learts header. Both accept the same props.
  const Header = activeTheme.Header ?? LeartsHeader

  return (
    <div
      className="sticky-header-wrapper"
      style={{ position: "relative", zIndex: 50 }}
    >
      <Header
        cartCount={cartCount}
        categories={categories ?? []}
        topbar={settings?.topbar ?? null}
        header={settings?.header ?? null}
        locale={locale}
      />
    </div>
  )
}
