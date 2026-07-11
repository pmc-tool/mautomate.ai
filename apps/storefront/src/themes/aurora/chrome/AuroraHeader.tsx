"use client"

import { useEffect, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Aurora (modern minimalist editorial) chrome header. Accepts EXACTLY  */
/* the same props as the Learts header so it is a drop-in replacement.   */
/* The CMS settings interfaces are re-declared here (copied from         */
/* @lib/data/cms via the Learts source) so this file is self-sufficient  */
/* and never depends on the Learts component. Tailwind utilities only —  */
/* no Bootstrap, no learts-* classes, no icon fonts.                     */
/* ------------------------------------------------------------------ */

export interface TopbarSettings {
  message: string
  enabled: boolean
  language_label: string
  currency_label: string
  links: { icon: string; label: string; href: string }[]
}

export interface HeaderMenuItem {
  label: string
  href?: string
  children_dynamic?: { source: "categories"; limit: number }
  source?: "categories"
  limit?: number
}

export interface HeaderSettings {
  logo: string
  logo_alt: string
  search: { enabled: boolean; placeholder: string; action: string }
  icons: { account: string; wishlist: string; cart: string }
  menu: HeaderMenuItem[]
  mobile_menu_categories: { source: "categories"; limit: number | null }
}

type Props = {
  cartCount: number
  categories: HttpTypes.StoreProductCategory[]
  topbar?: TopbarSettings | null
  header?: HeaderSettings | null
  /** Active CMS content locale ("en" | "bn"). Decoupled from region/currency. */
  locale?: "en" | "bn"
}

// Supported content locales offered by the language switcher.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "bn", label: "BN" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// Fallback values mirror the Learts defaults so the header renders even if
// the store API / settings are unavailable.
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
  icons: { account: "/account", wishlist: "/account", cart: "/cart" },
  menu: [
    { label: "Home", href: "/" },
    {
      label: "Shop",
      href: "/store",
      children_dynamic: { source: "categories", limit: 8 },
    },
    { label: DYNAMIC_CATEGORIES_TOKEN, source: "categories", limit: 3 },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact-us" },
  ],
  mobile_menu_categories: { source: "categories", limit: null },
}

/* ----------------------------- Icons ------------------------------ */

const IconSearch = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const IconUser = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

const IconHeart = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.3 4 2.5C10.8 6.3 12 5 14 5c3.5 0 5 3.5 3.5 6.5C19 15.65 12 20 12 20Z" />
  </svg>
)

const IconBag = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M6 7h12l-1 13H7L6 7Z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
)

const IconMenu = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

const IconClose = () => (
  <svg
    className="h-5 w-5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

/* ------------------------- Language switcher ---------------------- */

const LanguageSwitcher = ({ locale }: { locale: "en" | "bn" }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

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
    <div
      className="inline-flex items-center gap-1 text-xs font-medium tracking-wide text-neutral-500"
      aria-busy={isPending}
    >
      {LOCALE_OPTIONS.map((opt, i) => (
        <span key={opt.code} className="inline-flex items-center gap-1">
          {i > 0 && <span className="text-neutral-300">/</span>}
          <button
            type="button"
            aria-current={opt.code === locale ? "true" : undefined}
            onClick={() => select(opt.code)}
            className={
              opt.code === locale
                ? "text-neutral-900"
                : "text-neutral-400 hover:text-neutral-900 transition"
            }
          >
            {opt.label}
          </button>
        </span>
      ))}
    </div>
  )
}

/* ----------------------------- Search ----------------------------- */

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
    if (!q) {
      return
    }
    router.push(`/${countryCode}${action}${encodeURIComponent(q)}`)
    setOpen(false)
    setTerm("")
  }

  return (
    <div className="flex items-center">
      {open && (
        <form onSubmit={submit} className="mr-2">
          <input
            autoFocus
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onBlur={() => !term && setOpen(false)}
            placeholder={placeholder}
            aria-label="Search products"
            className="w-48 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-neutral-900 transition"
          />
        </form>
      )}
      <button
        type="button"
        aria-label="Search"
        onClick={(e) => {
          if (open) {
            submit(e)
          } else {
            setOpen(true)
          }
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
      >
        <IconSearch />
      </button>
    </div>
  )
}

/* --------------------------- Desktop nav -------------------------- */

const DesktopNav = ({
  menu,
  categories,
}: {
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
}) => (
  <nav className="hidden xl:flex items-center gap-8">
    {menu.map((item, i) => {
      if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
        const limit = item.limit ?? 3
        return categories.slice(0, limit).map((c) => (
          <LocalizedClientLink
            key={c.id}
            href={`/categories/${c.handle}`}
            className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
          >
            {c.name}
          </LocalizedClientLink>
        ))
      }

      if (item.children_dynamic) {
        return (
          <div key={`m-${i}`} className="group relative">
            <LocalizedClientLink
              href={item.href ?? "#"}
              className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
            >
              {item.label}
              <svg
                className="h-3 w-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </LocalizedClientLink>
            <div className="invisible absolute left-0 top-full z-50 min-w-[200px] translate-y-1 rounded-2xl border border-neutral-200 bg-white p-2 opacity-0 shadow-md transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
              <LocalizedClientLink
                href={item.href ?? "/store"}
                className="block rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
              >
                All Products
              </LocalizedClientLink>
              {categories.slice(0, item.children_dynamic.limit).map((c) => (
                <LocalizedClientLink
                  key={c.id}
                  href={`/categories/${c.handle}`}
                  className="block rounded-xl px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
                >
                  {c.name}
                </LocalizedClientLink>
              ))}
            </div>
          </div>
        )
      }

      return (
        <LocalizedClientLink
          key={`m-${i}`}
          href={item.href ?? "#"}
          className="text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
        >
          {item.label}
        </LocalizedClientLink>
      )
    })}
  </nav>
)

/* -------------------------- Cart / account ------------------------ */

const CartButton = ({
  href,
  cartCount,
}: {
  href: string
  cartCount: number
}) => (
  <LocalizedClientLink
    href={href}
    aria-label="Cart"
    className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
  >
    <IconBag />
    {cartCount > 0 && (
      <span
        className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none text-white"
        style={{ backgroundColor: "var(--aurora-accent)" }}
      >
        {cartCount}
      </span>
    )}
  </LocalizedClientLink>
)

/* ----------------------------- Header ----------------------------- */

const AuroraHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER
  const mobileLimit = hd.mobile_menu_categories?.limit ?? null
  const mobileCategories =
    mobileLimit == null ? categories : categories.slice(0, mobileLimit)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div className="aurora-theme font-sans">
      {/* Topbar */}
      {tb.enabled && (
        <div className="hidden border-b border-neutral-200 bg-neutral-50 md:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
            <p className="text-xs text-neutral-500">{tb.message}</p>
            <div className="flex items-center gap-6">
              <ul className="flex items-center gap-5">
                {tb.links.map((link, i) => (
                  <li key={i}>
                    {link.href.startsWith("/") ? (
                      <LocalizedClientLink
                        href={link.href}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition"
                      >
                        {link.label}
                      </LocalizedClientLink>
                    ) : (
                      <a
                        href={link.href}
                        className="text-xs text-neutral-500 hover:text-neutral-900 transition"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-neutral-500">
                  {tb.currency_label}
                </span>
                <LanguageSwitcher locale={locale} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main header (sticky) */}
      <header
        className={`sticky top-0 z-40 border-b bg-white/95 backdrop-blur transition-shadow ${
          scrolled ? "border-neutral-200 shadow-sm" : "border-neutral-200"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          {/* Left: mobile menu + logo */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition xl:hidden"
            >
              <IconMenu />
            </button>
            <LocalizedClientLink href="/" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hd.logo} style={chromeLogoStyle(hd as any)}
                alt={hd.logo_alt}
                className="h-8 w-auto object-contain"
              />
            </LocalizedClientLink>
          </div>

          {/* Center: desktop nav */}
          <DesktopNav menu={hd.menu} categories={categories} />

          {/* Right: tools */}
          <div className="flex items-center gap-1">
            {hd.search.enabled && (
              <div className="hidden sm:block">
                <HeaderSearch
                  placeholder={hd.search.placeholder}
                  action={hd.search.action}
                />
              </div>
            )}
            <LocalizedClientLink
              href={hd.icons.account}
              aria-label="Account"
              className="hidden h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition sm:inline-flex"
            >
              <IconUser />
            </LocalizedClientLink>
            <LocalizedClientLink
              href={hd.icons.wishlist}
              aria-label="Wishlist"
              className="hidden h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition sm:inline-flex"
            >
              <IconHeart />
            </LocalizedClientLink>
            <CartButton href={hd.icons.cart} cartCount={cartCount} />
          </div>
        </div>
      </header>

      {/* Mobile drawer overlay */}
      <div
        className={`fixed inset-0 z-50 bg-neutral-900/40 transition-opacity duration-200 xl:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85%] flex-col bg-white shadow-xl transition-transform duration-200 xl:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!menuOpen}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <LocalizedClientLink
            href="/"
            onClick={() => setMenuOpen(false)}
            className="flex items-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={hd.logo} style={chromeLogoStyle(hd as any)}
              alt={hd.logo_alt}
              className="h-7 w-auto object-contain"
            />
          </LocalizedClientLink>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 hover:bg-neutral-100 transition"
          >
            <IconClose />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {hd.menu.map((item, i) => {
              if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
                return mobileCategories.map((c) => (
                  <li key={c.id}>
                    <LocalizedClientLink
                      href={`/categories/${c.handle}`}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
                    >
                      {c.name}
                    </LocalizedClientLink>
                  </li>
                ))
              }
              return (
                <li key={`mm-${i}`}>
                  <LocalizedClientLink
                    href={item.href ?? "#"}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
                  >
                    {item.label}
                  </LocalizedClientLink>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-t border-neutral-200 px-3 py-4">
          <ul className="flex flex-col gap-1">
            <li>
              <LocalizedClientLink
                href={hd.icons.account}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
              >
                Account
              </LocalizedClientLink>
            </li>
            <li>
              <LocalizedClientLink
                href={hd.icons.cart}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition"
              >
                Cart
              </LocalizedClientLink>
            </li>
          </ul>
          <div className="mt-3 px-3">
            <LanguageSwitcher locale={locale} />
          </div>
        </div>
      </aside>
    </div>
  )
}

export default AuroraHeader
