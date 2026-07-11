"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Cignet chrome HEADER: the template's Topbar Section + main-header    */
/* (header-sticky navbar) rebuilt in React. Accepts EXACTLY the same    */
/* props as the Learts/Aurora headers so it is a drop-in replacement    */
/* (the CMS settings interfaces are re-declared here, copied from       */
/* @lib/data/cms, so this file stays self-sufficient).                  */
/*                                                                     */
/* Template JS is NOT loaded — everything the template did with jQuery  */
/* is reimplemented here:                                               */
/*  - sticky header: toggles the template's own "hide"/"active"         */
/*    classes on .header-sticky (same thresholds as js/function.js)     */
/*  - SlickNav mobile menu: a React toggle rendering slicknav-styled    */
/*    markup into .navbar-toggle / .responsive-menu                     */
/*  - search: the Bootstrap modal markup, opened/closed with state      */
/* Class names and DOM structure mirror index.html so                   */
/* /cignet/css/custom.css styles apply unchanged.                       */
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

// Supported content locales offered by the topbar language select.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "bn", label: "BN" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// The template's own topbar social icons (topbar settings carry no social
// list, so these are the Cignet presentational defaults).
const TOPBAR_SOCIAL: { icon: string; label: string; href: string }[] = [
  { icon: "fa-brands fa-pinterest-p", label: "Pinterest", href: "#" },
  { icon: "fa-brands fa-x-twitter", label: "Twitter", href: "#" },
  { icon: "fa-brands fa-facebook-f", label: "Facebook", href: "#" },
  { icon: "fa-brands fa-instagram", label: "Instagram", href: "#" },
]

// Fallback values mirror the CMS defaults so the header renders even if
// the store API / settings are unavailable. The logo default is the
// template's own asset (public/cignet/images).
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
  logo: "/cignet/images/logo.svg",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "Search Your Product",
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
    { label: "Contact", href: "/contact-us" },
  ],
  mobile_menu_categories: { source: "categories", limit: null },
}

/* ------------------------- Language select ------------------------ */
/* Rendered inside .topbar-currency-list so the template's white       */
/* transparent select styling applies. Switches the CMS content locale */
/* exactly like the Aurora LanguageSwitcher (updateLocale + refresh).  */

const LanguageSelect = ({ locale }: { locale: "en" | "bn" }) => {
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
    <select
      className="form-control form-select"
      aria-label="Language"
      aria-busy={isPending}
      value={locale}
      onChange={(e) => select(e.target.value as "en" | "bn")}
    >
      {LOCALE_OPTIONS.map((opt) => (
        <option key={opt.code} value={opt.code}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

/* --------------------------- Search modal ------------------------- */
/* The template opens a Bootstrap modal via data attributes; here the   */
/* same modal markup is rendered with React state and submits to the    */
/* store search route (mirrors Aurora's HeaderSearch routing).          */

const SearchModal = ({
  action,
  placeholder,
  onClose,
}: {
  action: string
  placeholder: string
  onClose: () => void
}) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const [term, setTerm] = useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (!q) {
      return
    }
    router.push(`/${countryCode}${action}${encodeURIComponent(q)}`)
    onClose()
  }

  return (
    <div
      className="modal fade show"
      style={{ display: "block" }}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <button
            type="button"
            className="close"
            aria-label="Close"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
          <form className="modal-search-form" onSubmit={submit}>
            <input
              autoFocus
              type="text"
              name="search"
              className="form-control"
              placeholder={placeholder}
              aria-label="Search products"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <button
              type="submit"
              className="modal-search-btn"
              aria-label="Submit search"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

/* --------------------------- Desktop nav -------------------------- */
/* Dropdowns are pure CSS in the template (.main-menu ul li:hover > ul) */
/* so submenu items only need the template's li.submenu structure.      */

const DesktopNav = ({
  menu,
  categories,
}: {
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
}) => (
  <ul className="navbar-nav">
    {menu.map((item, i) => {
      if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
        const limit = item.limit ?? 3
        return categories.slice(0, limit).map((c) => (
          <li key={c.id} className="nav-item">
            <LocalizedClientLink
              href={`/categories/${c.handle}`}
              className="nav-link"
            >
              {c.name}
            </LocalizedClientLink>
          </li>
        ))
      }

      if (item.children_dynamic) {
        return (
          <li key={`m-${i}`} className="nav-item submenu">
            <LocalizedClientLink href={item.href ?? "#"} className="nav-link">
              {item.label}
            </LocalizedClientLink>
            <ul>
              <li className="nav-item">
                <LocalizedClientLink
                  href={item.href ?? "/store"}
                  className="nav-link"
                >
                  All Products
                </LocalizedClientLink>
              </li>
              {categories.slice(0, item.children_dynamic.limit).map((c) => (
                <li key={c.id} className="nav-item">
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    className="nav-link"
                  >
                    {c.name}
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          </li>
        )
      }

      return (
        <li key={`m-${i}`} className="nav-item">
          <LocalizedClientLink href={item.href ?? "#"} className="nav-link">
            {item.label}
          </LocalizedClientLink>
        </li>
      )
    })}
  </ul>
)

/* ----------------------------- Header ----------------------------- */

const CignetHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Sticky states use the template's own class names ("hide"/"active").
  const [hidden, setHidden] = useState(false)
  const [stuck, setStuck] = useState(false)
  const headerRef = useRef<HTMLElement | null>(null)
  const stickyRef = useRef<HTMLDivElement | null>(null)

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER
  const mobileLimit = hd.mobile_menu_categories?.limit ?? null
  const mobileCategories =
    mobileLimit == null ? categories : categories.slice(0, mobileLimit)

  /* Sticky header — same behavior as the template's js/function.js:
     - lock the <header> height so nothing jumps when .header-sticky
       goes position:fixed
     - "hide" past (header height + 100), "active" past 600 */
  useEffect(() => {
    const onScrollOrResize = () => {
      const sticky = stickyRef.current
      const host = headerRef.current
      if (!sticky || !host) {
        return
      }
      const stickyHeight = sticky.offsetHeight
      host.style.height = `${stickyHeight}px`
      const fromTop = window.scrollY
      setHidden(fromTop > stickyHeight + 100)
      setStuck(fromTop > 600)
    }
    onScrollOrResize()
    window.addEventListener("scroll", onScrollOrResize, { passive: true })
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [])

  const closeMenu = () => setMenuOpen(false)

  const stickyClassName = [
    "header-sticky",
    hidden ? "hide" : "",
    stuck ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="cignet-theme">
      {/* Topbar Section */}
      {tb.enabled && (
        <div className="topbar">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-md-3 col-7">
                {/* Topbar Social List */}
                <div className="topbar-social-list">
                  <ul>
                    {TOPBAR_SOCIAL.map((s, i) => (
                      <li key={i}>
                        <a href={s.href} aria-label={s.label}>
                          <i className={s.icon}></i>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="col-md-6 col-0">
                {/* Topbar Info Content */}
                <div className="topbar-info-content">
                  <p>{tb.message}</p>
                </div>
              </div>

              <div className="col-md-3 col-5">
                {/* Topbar links + language (replaces the dummy currency
                    select; same slot, same select styling) */}
                <div
                  className="topbar-currency-list"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 15,
                  }}
                >
                  {tb.links.map((link, i) =>
                    link.href.startsWith("/") ? (
                      <LocalizedClientLink
                        key={i}
                        href={link.href}
                        className="d-none d-lg-inline-block"
                        style={{ color: "var(--white-color)" }}
                      >
                        {link.label}
                      </LocalizedClientLink>
                    ) : (
                      <a
                        key={i}
                        href={link.href}
                        className="d-none d-lg-inline-block"
                        style={{ color: "var(--white-color)" }}
                      >
                        {link.label}
                      </a>
                    )
                  )}
                  <LanguageSelect locale={locale} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="main-header" ref={headerRef}>
        <div className={stickyClassName} ref={stickyRef}>
          <nav className="navbar navbar-expand-lg">
            <div className="container">
              {/* Logo */}
              <LocalizedClientLink className="navbar-brand" href="/">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hd.logo} style={chromeLogoStyle(hd as any)} alt={hd.logo_alt} />
              </LocalizedClientLink>

              {/* Main Menu */}
              <div className="main-menu">
                <div className="collapse navbar-collapse">
                  <div className="nav-menu-wrapper">
                    <DesktopNav menu={hd.menu} categories={categories} />
                  </div>
                </div>

                {/* Mobile hamburger (SlickNav button markup, React state) */}
                <div className="navbar-toggle">
                  <a
                    href="#menu"
                    role="button"
                    aria-label={menuOpen ? "Close menu" : "Open menu"}
                    aria-expanded={menuOpen}
                    className={`slicknav_btn ${
                      menuOpen ? "slicknav_open" : "slicknav_collapsed"
                    }`}
                    onClick={(e) => {
                      e.preventDefault()
                      setMenuOpen((open) => !open)
                    }}
                  >
                    <span className="slicknav_menutxt"></span>
                    <span className="slicknav_icon">
                      <span className="slicknav_icon-bar"></span>
                      <span className="slicknav_icon-bar"></span>
                      <span className="slicknav_icon-bar"></span>
                    </span>
                  </a>
                </div>

                {/* Header Action Details */}
                <div className="header-action-details">
                  <ul>
                    {hd.search.enabled && (
                      <li>
                        <button
                          type="button"
                          aria-label="Search"
                          onClick={() => setSearchOpen(true)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/cignet/images/icon-search-primary.svg"
                            alt=""
                          />
                        </button>
                        {searchOpen && (
                          <SearchModal
                            action={hd.search.action}
                            placeholder={hd.search.placeholder}
                            onClose={() => setSearchOpen(false)}
                          />
                        )}
                      </li>
                    )}
                    <li>
                      <LocalizedClientLink
                        href={hd.icons.account}
                        aria-label="Account"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/cignet/images/icon-user-primary.svg"
                          alt=""
                        />
                      </LocalizedClientLink>
                    </li>
                    <li>
                      <LocalizedClientLink
                        href={hd.icons.wishlist}
                        aria-label="Wishlist"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/cignet/images/icon-wishlist-primary.svg"
                          alt=""
                        />
                      </LocalizedClientLink>
                    </li>
                    <li style={{ position: "relative" }}>
                      <LocalizedClientLink
                        href={hd.icons.cart}
                        aria-label="Cart"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/cignet/images/icon-cart-primary.svg"
                          alt=""
                        />
                        {cartCount > 0 && (
                          <span
                            style={{
                              position: "absolute",
                              top: -8,
                              right: -10,
                              minWidth: 16,
                              height: 16,
                              padding: "0 4px",
                              borderRadius: 8,
                              background: "var(--accent-color)",
                              color: "var(--white-color)",
                              fontSize: 10,
                              fontWeight: 600,
                              lineHeight: "16px",
                              textAlign: "center",
                            }}
                          >
                            {cartCount}
                          </span>
                        )}
                      </LocalizedClientLink>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </nav>

          {/* Mobile menu panel (SlickNav markup, React state) */}
          <div className="responsive-menu">
            {menuOpen && (
              <div className="slicknav_menu">
                <ul className="slicknav_nav" role="menu">
                  {hd.menu.map((item, i) => {
                    if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
                      return mobileCategories.map((c) => (
                        <li key={c.id}>
                          <LocalizedClientLink
                            href={`/categories/${c.handle}`}
                            onClick={closeMenu}
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
                          onClick={closeMenu}
                        >
                          {item.label}
                        </LocalizedClientLink>
                      </li>
                    )
                  })}
                  <li>
                    <LocalizedClientLink
                      href={hd.icons.account}
                      onClick={closeMenu}
                    >
                      My Account
                    </LocalizedClientLink>
                  </li>
                  <li>
                    <LocalizedClientLink
                      href={hd.icons.cart}
                      onClick={closeMenu}
                    >
                      Cart
                    </LocalizedClientLink>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>
    </div>
  )
}

export default CignetHeader
