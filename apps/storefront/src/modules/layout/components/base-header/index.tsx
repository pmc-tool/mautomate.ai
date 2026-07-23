"use client"

import { useState, useTransition } from "react"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"
import { useWishlist } from "@lib/context/wishlist-context"
import type {
  HeaderSettings,
  HeaderMenuItem,
  TopbarSettings,
} from "@lib/data/cms"

type Props = {
  cartCount: number
  categories: HttpTypes.StoreProductCategory[]
  topbar?: TopbarSettings | null
  header?: HeaderSettings | null
  /** Active CMS content locale ("en" | "bn"). Decoupled from region/currency. */
  locale?: "en" | "bn"
}

// Supported content locales offered by the topbar switcher.
// Decoupled from countryCode/currency — switching only re-resolves CMS text.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
]

/**
 * Real locale switcher for the topbar. Renders the current locale label with a
 * hover dropdown of the supported locales; selecting one calls the updateLocale
 * server action (sets the cookie + revalidates) then refreshes so all CMS
 * content re-resolves in the chosen locale. Region/BDT pricing is untouched.
 */
const LocaleSwitcher = ({ locale }: { locale: "en" | "bn" }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const current =
    LOCALE_OPTIONS.find((o) => o.code === locale) ?? LOCALE_OPTIONS[0]

  const select = (code: "en" | "bn") => {
    if (code === locale || isPending) {
      return
    }
    startTransition(async () => {
      await updateLocale(code)
      router.refresh()
    })
  }

  return (
    <li className="has-children">
      <a
        href="#"
        aria-label="Change language"
        aria-busy={isPending}
        onClick={(e) => e.preventDefault()}
      >
        {current.label}
      </a>
      <ul className="sub-menu">
        {LOCALE_OPTIONS.map((opt) => (
          <li key={opt.code}>
            <a
              href="#"
              aria-current={opt.code === locale ? "true" : undefined}
              style={opt.code === locale ? { fontWeight: 600 } : undefined}
              onClick={(e) => {
                e.preventDefault()
                select(opt.code)
              }}
            >
              {opt.label}
            </a>
          </li>
        ))}
      </ul>
    </li>
  )
}

// Sentinel label for an item that expands to top-level category links.
// (Value mirrors DYNAMIC_CATEGORIES_TOKEN in @lib/data/cms; redefined locally
// because cms.ts is server-only and cannot be value-imported in a client file.)
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// Fallback values = the previous hardcoded Learts chrome. Used only if the
// store API / settings are unavailable so the header renders identically.
const FALLBACK_TOPBAR: TopbarSettings = {
  message: "Free shipping for orders over $59 !",
  enabled: true,
  language_label: "English",
  currency_label: "BDT",
  links: [
    { icon: "fa-map-marker-alt", label: "Store Location", href: "#" },
    { icon: "fa-truck", label: "Order Status", href: "/account" },
  ],
}

const FALLBACK_HEADER: HeaderSettings = {
  logo: "/learts/assets/images/logo/forever-finds.png",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "Search products…",
    action: "/store?q=",
  },
  icons: { account: "/account", wishlist: "/wishlist", cart: "/cart" },
  menu: [
    { label: "Home", href: "/" },
    {
      label: "Shop",
      href: "/store",
      children_dynamic: { source: "categories", limit: 8 },
    },
    { label: DYNAMIC_CATEGORIES_TOKEN, source: "categories", limit: 3 },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ],
  mobile_menu_categories: { source: "categories", limit: null },
}

const HeaderSearch = ({
  placeholder,
  action,
}: {
  placeholder: string
  action: string
}) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (!q) return
    router.push(`/${countryCode}${action}${encodeURIComponent(q)}`)
    setOpen(false)
    setTerm("")
  }

  return (
    <div
      className="header-search d-none d-sm-block"
      style={{ display: "flex", alignItems: "center" }}
      data-el="search"
    >
      {open && (
        <form onSubmit={submit} style={{ marginRight: 8 }}>
          <input
            autoFocus
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={() => !term && setOpen(false)}
            placeholder={placeholder}
            aria-label="Search products"
            style={{
              border: "1px solid #e5e5e5",
              borderRadius: 4,
              padding: "6px 12px",
              fontSize: 14,
              width: 200,
              outline: "none",
            }}
          />
        </form>
      )}
      <a
        href="#"
        aria-label="Search"
        onClick={(e) => {
          e.preventDefault()
          if (open) submit(e)
          else setOpen(true)
        }}
      >
        <i className="fas fa-search" />
      </a>
    </div>
  )
}

/** Serialize a DimensionsControl value ({top,right,bottom,left,unit}) to a CSS
 *  shorthand, or undefined when empty. Missing sides default to 0. */
const dimToCss = (
  d?: { top?: number; right?: number; bottom?: number; left?: number; unit?: string }
): string | undefined => {
  if (!d || typeof d !== "object") return undefined
  const { top, right, bottom, left } = d
  if (top == null && right == null && bottom == null && left == null) {
    return undefined
  }
  const u = d.unit || "px"
  const s = (n?: number) => `${n ?? 0}${u}`
  return `${s(top)} ${s(right)} ${s(bottom)} ${s(left)}`
}

const BrandLogo = ({
  src,
  alt,
  small,
  maxHeight,
  padding,
  margin,
}: {
  src: string
  alt: string
  small?: boolean
  maxHeight?: { value: number; unit: string }
  padding?: { top?: number; right?: number; bottom?: number; left?: number; unit?: string }
  margin?: { top?: number; right?: number; bottom?: number; left?: number; unit?: string }
}) => {
  const height =
    maxHeight && typeof maxHeight.value === "number"
      ? `${maxHeight.value}${maxHeight.unit || "px"}`
      : small
      ? 24
      : 34
  // No usable custom logo (empty, or still the Forever Finds default): render
  // the store NAME as a styled text logo instead of an image, so a tenant store
  // never shows the FF logo. A store that uploaded its own logo renders it.
  if (!src || src.includes("forever-finds")) {
    const fontSize =
      typeof height === "number"
        ? Math.round(height * 0.7)
        : `calc(${height} * 0.7)`
    return (
      <span
        style={{
          display: "block",
          fontFamily: "Marcellus, Georgia, serif",
          fontSize,
          fontWeight: 500,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          color: "var(--ff-c-heading, #1f1f1f)",
          padding: dimToCss(padding),
          margin: dimToCss(margin),
        }}
      >
        {alt || "Store"}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      style={{
        height,
        width: "auto",
        display: "block",
        padding: dimToCss(padding),
        margin: dimToCss(margin),
      }}
    />
  )
}

const HeaderTools = ({
  cartCount,
  header,
}: {
  cartCount: number
  header: HeaderSettings
}) => {
  const { count: wishlistCount } = useWishlist()

  return (
  <div className="header-tools justify-content-end" data-el="icons">
    <div className="header-login">
      <LocalizedClientLink href={header.icons.account}>
        <i className="far fa-user" />
      </LocalizedClientLink>
    </div>
    {header.search.enabled && (
      <HeaderSearch
        placeholder={header.search.placeholder}
        action={header.search.action}
      />
    )}
    <div className="header-wishlist">
      <LocalizedClientLink href={header.icons.wishlist}>
        {wishlistCount > 0 && (
          <span className="cart-count">{wishlistCount}</span>
        )}
        <i className="far fa-heart" />
      </LocalizedClientLink>
    </div>
    <div className="header-cart">
      <LocalizedClientLink href={header.icons.cart}>
        {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        <i className="fas fa-shopping-cart" />
      </LocalizedClientLink>
    </div>
  </div>
  )
}

/**
 * HYBRID desktop menu. For each settings menu item:
 *  - `__dynamic_categories__` sentinel  → expand top-level category links (its own limit)
 *  - item with `children_dynamic`        → manual link + dynamic submenu (its own limit)
 *  - plain item                          → manual link
 * The three live-category limits (Shop submenu, top-level sentinel, mobile) stay
 * independent — see header.mobile_menu_categories for the mobile one.
 */
const MainMenu = ({
  menu,
  categories,
}: {
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
}) => (
  <nav
    className="site-main-menu site-main-menu-left menu-height-100 justify-content-center"
    data-el="menu"
  >
    <ul>
      {menu.map((item, i) => {
        if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
          const limit = item.limit ?? 3
          return categories.slice(0, limit).map((c) => (
            <li key={c.id}>
              <LocalizedClientLink href={`/categories/${c.handle}`}>
                <span className="menu-text">{c.name}</span>
              </LocalizedClientLink>
            </li>
          ))
        }

        if (item.children_dynamic) {
          return (
            <li key={`m-${i}`} className="has-children">
              <LocalizedClientLink href={item.href ?? "#"}>
                <span className="menu-text">{item.label}</span>
              </LocalizedClientLink>
              <ul className="sub-menu">
                <li>
                  <LocalizedClientLink href={item.href ?? "/store"}>
                    <span className="menu-text">All Products</span>
                  </LocalizedClientLink>
                </li>
                {categories.slice(0, item.children_dynamic.limit).map((c) => (
                  <li key={c.id}>
                    <LocalizedClientLink href={`/categories/${c.handle}`}>
                      <span className="menu-text">{c.name}</span>
                    </LocalizedClientLink>
                  </li>
                ))}
              </ul>
            </li>
          )
        }

        return (
          <li key={`m-${i}`}>
            <LocalizedClientLink href={item.href ?? "#"}>
              <span className="menu-text">{item.label}</span>
            </LocalizedClientLink>
          </li>
        )
      })}
    </ul>
  </nav>
)

const TopbarLink = ({
  link,
}: {
  link: { icon: string; label: string; href: string }
}) => {
  const inner = (
    <>
      <i className={`fa ${link.icon}`} />
      {link.label}
    </>
  )
  // Internal app paths get locale-prefixed; placeholders / external use <a>.
  return link.href.startsWith("/") ? (
    <LocalizedClientLink href={link.href}>{inner}</LocalizedClientLink>
  ) : (
    <a href={link.href}>{inner}</a>
  )
}

const BaseHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const [menuOpen, setMenuOpen] = useState(false)

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER
  const mobileLimit = hd.mobile_menu_categories?.limit ?? null
  const mobileCategories =
    mobileLimit == null ? categories : categories.slice(0, mobileLimit)

  return (
    <div className="learts-theme">
      {/* Topbar */}
      {tb.enabled && (
        <div className="topbar-section section section-fluid cms-chrome-topbar">
          <div className="container">
            <div className="row justify-content-between align-items-center">
              <div className="col-md-auto col-12">
                <p
                  className="text-center text-md-left my-2"
                  data-el="message"
                >
                  {tb.message}
                </p>
              </div>
              <div className="col-auto d-none d-md-block">
                <div className="topbar-menu d-flex flex-row-reverse">
                  <ul className="header-lan-curr">
                    <LocaleSwitcher locale={locale} />
                    <li>
                      <a href="#">{tb.currency_label}</a>
                    </li>
                  </ul>
                  <ul data-el="links">
                    {tb.links.map((link, i) => (
                      <li key={i}>
                        <TopbarLink link={link} />
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop header */}
      <div className="header-section section section-fluid bg-white d-none d-xl-block cms-chrome-header">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-auto">
              <div className="header-logo" data-el="logo">
                <LocalizedClientLink href="/">
                  <BrandLogo
                    src={hd.logo}
                    alt={hd.logo_alt}
                    maxHeight={hd.logo_max_height}
                    padding={hd.logo_padding}
                    margin={hd.logo_margin}
                  />
                </LocalizedClientLink>
              </div>
            </div>
            <div className="col-auto me-auto">
              <MainMenu menu={hd.menu} categories={categories} />
            </div>
            <div className="col-auto">
              <HeaderTools cartCount={cartCount} header={hd} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile header */}
      <div
        className="mobile-header section section-fluid bg-white d-block d-xl-none cms-chrome-header"
        style={{ borderBottom: "1px solid #eee", padding: "8px 0" }}
      >
        <div className="container">
          <div className="row align-items-center">
            <div className="col-auto">
              <button
                type="button"
                className="mobile-menu-open-btn"
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  padding: "10px 0",
                }}
              >
                <i className="fas fa-bars" />
              </button>
            </div>
            <div className="col-auto mx-auto">
              <div className="header-logo" data-el="logo">
                <LocalizedClientLink href="/">
                  <BrandLogo src={hd.logo} alt={hd.logo_alt} small />
                </LocalizedClientLink>
              </div>
            </div>
            <div className="col-auto">
              <div className="header-cart">
                <LocalizedClientLink href={hd.icons.cart}>
                  {cartCount > 0 && (
                    <span className="cart-count">{cartCount}</span>
                  )}
                  <i className="fas fa-shopping-cart" />
                </LocalizedClientLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile offcanvas menu */}
      <div
        className={`learts-mobile-overlay ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />
      <div className={`learts-mobile-menu ${menuOpen ? "open" : ""}`}>
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
          style={{
            background: "none",
            border: "none",
            fontSize: 22,
            float: "right",
          }}
        >
          <i className="fas fa-times" />
        </button>
        <ul onClick={() => setMenuOpen(false)} style={{ clear: "both" }}>
          {hd.menu.map((item, i) => {
            if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
              return mobileCategories.map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink href={`/categories/${c.handle}`}>
                    {c.name}
                  </LocalizedClientLink>
                </li>
              ))
            }
            return (
              <li key={`mm-${i}`}>
                <LocalizedClientLink href={item.href ?? "#"}>
                  {item.label}
                </LocalizedClientLink>
              </li>
            )
          })}
          <li>
            <LocalizedClientLink href={hd.icons.account}>
              Account
            </LocalizedClientLink>
          </li>
          <li>
            <LocalizedClientLink href={hd.icons.cart}>Cart</LocalizedClientLink>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default BaseHeader
