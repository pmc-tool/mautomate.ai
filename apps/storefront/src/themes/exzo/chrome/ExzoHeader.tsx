"use client"

import { useEffect, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Exzo chrome HEADER: the template's header (header-top contact bar +  */
/* header-bottom logo/nav/search, index1.html) rebuilt in React.        */
/* Accepts EXACTLY the same props as the Learts/Aurora/Cignet headers   */
/* so it is a drop-in replacement (the CMS settings interfaces are      */
/* re-declared here, copied from @lib/data/cms, so this file stays      */
/* self-sufficient).                                                    */
/*                                                                     */
/* Template JS is NOT loaded — everything js/global.js did with jQuery  */
/* is reimplemented here:                                               */
/*  - sticky header: the template's <header> is ALWAYS position:fixed   */
/*    (style.css) with a .header-empty-space spacer; global.js only     */
/*    adds "scrolled" past 300px (slides the header-top away). Same     */
/*    threshold here via a scroll listener.                             */
/*  - responsive menu: "active" on .nav-wrapper (hamburger-icon /       */
/*    .nav-close-layer / .navigation-title clicks), and per-item        */
/*    .menu-toggle expansion (jQuery slideToggle -> inline display      */
/*    block toggled by React state; desktop keeps its own               */
/*    display:block!important so the inline style is inert there).      */
/*  - search: "active" on .header-search-wrapper, submit routes to the  */
/*    store search page.                                                */
/* Desktop nav dropdowns, the language toggle and the cart-toggle       */
/* preview are pure CSS :hover in the template (style.css) — their      */
/* markup is kept and no JS is needed.                                  */
/* Class names and DOM structure mirror index1.html so /exzo/css/*.css  */
/* styles apply unchanged. The cart entry keeps the template's          */
/* .cart-icon/.cart-label markup with the LIVE cart count; the hover    */
/* cart-toggle renders a simplified live summary (count + view-bag      */
/* button) because the chrome only receives cartCount.                  */
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

// Supported content locales offered by the header-top language toggle.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "en" },
  { code: "bn", label: "bn" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// Fallback values mirror the CMS defaults so the header renders even if
// the store API / settings are unavailable. The logo default is the
// template's own asset (public/exzo/img).
const FALLBACK_TOPBAR: TopbarSettings = {
  message: "Free shipping for orders over $59 !",
  enabled: true,
  language_label: "English",
  currency_label: "BDT",
  links: [
    { icon: "fa-map-marker", label: "Store Location", href: "#" },
    { icon: "fa-truck", label: "Order Status", href: "/account" },
  ],
}

const FALLBACK_HEADER: HeaderSettings = {
  logo: "/exzo/img/logo-2.png",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "Enter keyword",
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

/* ------------------------- Language toggle ------------------------ */
/* The template's .language entry reveals .language-toggle on CSS       */
/* :hover; the links switch the CMS content locale exactly like the    */
/* Cignet/Shofy headers (updateLocale + router.refresh).               */

const LanguageEntry = ({ locale }: { locale: "en" | "bn" }) => {
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
    <div className="entry language" aria-busy={isPending}>
      <div className="title">
        <b>{locale}</b>
      </div>
      <div className="language-toggle header-toggle-animation">
        {LOCALE_OPTIONS.filter((opt) => opt.code !== locale).map((opt) => (
          <a
            key={opt.code}
            role="button"
            tabIndex={0}
            onClick={() => select(opt.code)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                select(opt.code)
              }
            }}
          >
            {opt.label}
          </a>
        ))}
      </div>
    </div>
  )
}

/* ----------------------------- Nav item --------------------------- */
/* One shared DOM serves both modes: desktop dropdowns open on CSS      */
/* :hover (nav > ul > li:hover > ul, plus display:block!important at    */
/* >=992px), while the responsive mode hides submenus (display:none)    */
/* until .menu-toggle is clicked — the jQuery slideToggle becomes an    */
/* inline display:block controlled by React state.                      */

const NavItems = ({
  menu,
  categories,
  onNavigate,
}: {
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
  onNavigate: () => void
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <ul>
      {menu.map((item, i) => {
        if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
          const limit = item.limit ?? 3
          return categories.slice(0, limit).map((c) => (
            <li key={c.id}>
              <LocalizedClientLink
                href={`/categories/${c.handle}`}
                onClick={onNavigate}
              >
                {c.name}
              </LocalizedClientLink>
            </li>
          ))
        }

        if (item.children_dynamic) {
          const open = openIndex === i
          return (
            <li key={`m-${i}`}>
              <LocalizedClientLink href={item.href ?? "#"} onClick={onNavigate}>
                {item.label}
              </LocalizedClientLink>
              <div
                className={`menu-toggle${open ? " active" : ""}`}
                role="button"
                aria-label={`Toggle ${item.label} submenu`}
                aria-expanded={open}
                onClick={() => setOpenIndex(open ? null : i)}
              ></div>
              <ul style={open ? { display: "block" } : undefined}>
                <li>
                  <LocalizedClientLink
                    href={item.href ?? "/store"}
                    onClick={onNavigate}
                  >
                    All Products
                  </LocalizedClientLink>
                </li>
                {categories.slice(0, item.children_dynamic.limit).map((c) => (
                  <li key={c.id}>
                    <LocalizedClientLink
                      href={`/categories/${c.handle}`}
                      onClick={onNavigate}
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
          <li key={`m-${i}`}>
            <LocalizedClientLink href={item.href ?? "#"} onClick={onNavigate}>
              {item.label}
            </LocalizedClientLink>
          </li>
        )
      })}
    </ul>
  )
}

/* ----------------------------- Header ----------------------------- */

const ExzoHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }

  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [term, setTerm] = useState("")

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER

  /* Sticky header — same behavior as js/global.js scrollCall():
     header gets "scrolled" past 300px (slides the header-top away on
     desktop; the header itself is always position:fixed in style.css,
     offset by the .header-empty-space spacer below). */
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 300)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
    }
  }, [])

  const closeMenu = () => setMenuOpen(false)

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (!q) {
      return
    }
    router.push(`/${countryCode}${hd.search.action}${encodeURIComponent(q)}`)
    setSearchOpen(false)
    setTerm("")
  }

  return (
    <div className="exzo-theme">
      <header className={scrolled ? "scrolled" : ""}>
        <div className="header-top">
          <div className="content-margins">
            <div className="row">
              <div className="col-md-5 hidden-xs hidden-sm">
                {tb.enabled && (
                  <div className="entry">
                    <b>{tb.message}</b>
                  </div>
                )}
                {tb.links.map((link, i) => (
                  <div key={i} className="entry">
                    {link.href.startsWith("/") ? (
                      <LocalizedClientLink href={link.href}>
                        <b>{link.label}</b>
                      </LocalizedClientLink>
                    ) : (
                      <a href={link.href}>
                        <b>{link.label}</b>
                      </a>
                    )}
                  </div>
                ))}
              </div>
              <div className="col-md-7 col-md-text-right">
                <div className="entry">
                  <LocalizedClientLink href={hd.icons.account}>
                    <b>login</b>
                  </LocalizedClientLink>
                  &nbsp; or &nbsp;
                  <LocalizedClientLink href={hd.icons.account}>
                    <b>register</b>
                  </LocalizedClientLink>
                </div>
                <LanguageEntry locale={locale} />
                <div className="entry hidden-xs hidden-sm">
                  <LocalizedClientLink
                    href={hd.icons.wishlist}
                    aria-label="Wishlist"
                  >
                    <i className="fa fa-heart-o" aria-hidden="true"></i>
                  </LocalizedClientLink>
                </div>
                <div className="entry hidden-xs hidden-sm cart">
                  <LocalizedClientLink href={hd.icons.cart} aria-label="Cart">
                    <b className="hidden-xs">Your bag</b>
                    <span className="cart-icon">
                      <i className="fa fa-shopping-bag" aria-hidden="true"></i>
                      {cartCount > 0 && (
                        <span className="cart-label">{cartCount}</span>
                      )}
                    </span>
                    <span className="cart-title hidden-xs">
                      {cartCount === 1 ? "1 item" : `${cartCount} items`}
                    </span>
                  </LocalizedClientLink>
                  {/* Hover cart preview (CSS :hover reveal). Simplified
                      live summary: the chrome receives only cartCount. */}
                  <div className="cart-toggle hidden-xs hidden-sm">
                    <div className="cart-overflow">
                      <div className="simple-article size-3">
                        {cartCount > 0
                          ? `You have ${cartCount} item${
                              cartCount === 1 ? "" : "s"
                            } in your bag.`
                          : "Your bag is empty."}
                      </div>
                    </div>
                    <div className="empty-space col-xs-b40"></div>
                    <div className="row">
                      <div className="col-xs-6">
                        <div className="cell-view empty-space col-xs-b50">
                          <div className="simple-article size-5 grey">
                            ITEMS <span className="color">{cartCount}</span>
                          </div>
                        </div>
                      </div>
                      <div className="col-xs-6 text-right">
                        <LocalizedClientLink
                          className="button size-2 style-3"
                          href={hd.icons.cart}
                        >
                          <span className="button-wrapper">
                            <span className="icon">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/exzo/img/icon-4.png" alt="" />
                            </span>
                            <span className="text">view your bag</span>
                          </span>
                        </LocalizedClientLink>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  className="hamburger-icon"
                  role="button"
                  aria-label="Open menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="header-bottom">
          <div className="content-margins">
            <div className="row">
              <div className="col-xs-3 col-sm-1">
                <LocalizedClientLink id="logo" href="/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hd.logo} style={chromeLogoStyle(hd as any)} alt={hd.logo_alt} />
                </LocalizedClientLink>
              </div>
              <div className="col-xs-9 col-sm-11 text-right">
                <div className={`nav-wrapper${menuOpen ? " active" : ""}`}>
                  <div className="nav-close-layer" onClick={closeMenu}></div>
                  <nav>
                    <NavItems
                      menu={hd.menu}
                      categories={categories}
                      onNavigate={closeMenu}
                    />
                    <div className="navigation-title">
                      Navigation
                      <div
                        className="hamburger-icon active"
                        role="button"
                        aria-label="Close menu"
                        onClick={closeMenu}
                      >
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </nav>
                </div>
                {hd.search.enabled && (
                  <div
                    className="header-bottom-icon toggle-search"
                    role="button"
                    aria-label="Search"
                    aria-expanded={searchOpen}
                    onClick={() => setSearchOpen((open) => !open)}
                  >
                    <i className="fa fa-search" aria-hidden="true"></i>
                  </div>
                )}
                <LocalizedClientLink
                  className="header-bottom-icon visible-rd"
                  href={hd.icons.wishlist}
                  aria-label="Wishlist"
                >
                  <i className="fa fa-heart-o" aria-hidden="true"></i>
                </LocalizedClientLink>
                <LocalizedClientLink
                  className="header-bottom-icon visible-rd"
                  href={hd.icons.cart}
                  aria-label="Cart"
                >
                  <i className="fa fa-shopping-bag" aria-hidden="true"></i>
                  {cartCount > 0 && (
                    <span className="cart-label">{cartCount}</span>
                  )}
                </LocalizedClientLink>
              </div>
            </div>
            {hd.search.enabled && (
              <div
                className={`header-search-wrapper${
                  searchOpen ? " active" : ""
                }`}
              >
                <div className="header-search-content">
                  <div className="container-fluid">
                    <div className="row">
                      <div className="col-sm-8 col-sm-offset-2 col-lg-6 col-lg-offset-3">
                        <form onSubmit={submitSearch}>
                          <div className="search-submit">
                            <i className="fa fa-search" aria-hidden="true"></i>
                            <input type="submit" aria-label="Submit search" />
                          </div>
                          <input
                            className="simple-input style-1"
                            type="text"
                            placeholder={hd.search.placeholder}
                            aria-label="Search products"
                            value={term}
                            onChange={(e) => setTerm(e.target.value)}
                          />
                        </form>
                      </div>
                    </div>
                  </div>
                  <div
                    className="button-close"
                    role="button"
                    aria-label="Close search"
                    onClick={() => setSearchOpen(false)}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Fixed-header spacer (the template's own element; global.js reads
          its height for page calculations we don't need). */}
      <div className="header-empty-space"></div>
    </div>
  )
}

export default ExzoHeader
