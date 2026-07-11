"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Helendo chrome HEADER: the template's standard (non-absolute)        */
/* header from shop-left-sidebar.html rebuilt in React. Accepts EXACTLY */
/* the same props as the Cignet/Learts/Aurora headers so it is a        */
/* drop-in replacement (the CMS settings interfaces are re-declared     */
/* here, copied from @lib/data/cms, so this file stays self-sufficient).*/
/*                                                                     */
/* Template JS is NOT loaded — everything assets/js/main.js did with    */
/* jQuery is reimplemented here:                                        */
/*  - sticky header: toggles the template's own "is-sticky" class on    */
/*    .header-sticky once scrolled past the header height               */
/*  - offcanvas menu: #mobile-menu-overlay gets "active", body gets     */
/*    "no-overflow" (body.no-overflow { overflow: hidden } in           */
/*    style.css); sub-menus open by adding "active" to li.has-children  */
/*    and conditionally rendering ul.sub-menu (the template hid them    */
/*    with jQuery slideUp only, not CSS)                                */
/*  - search overlay: #search-overlay gets "active" + body no-overflow  */
/* Class names and DOM structure mirror the template HTML so            */
/* /helendo/css/style.css styles apply unchanged.                       */
/*                                                                     */
/* NOTE: this template has NO horizontal desktop nav — the hamburger    */
/* offcanvas IS the navigation on every viewport.                       */
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

// Supported content locales offered by the offcanvas language widget.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "Bangla" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// Fallback values mirror the CMS defaults so the header renders even if
// the store API / settings are unavailable. The logo default is the
// template's own asset (public/helendo/images). The Helendo header has
// no topbar strip; the topbar prop is accepted for chrome-contract
// parity but not rendered.
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
  logo: "/helendo/images/logo/logo.svg",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "Search Anything...",
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

/* ------------------------ Language widget ------------------------- */
/* Rendered inside .offcanvas-menu-header using the template's          */
/* .widget-language markup (li.actived marks the current locale).       */
/* Switches the CMS content locale exactly like Cignet's LanguageSelect */
/* (updateLocale + router.refresh).                                     */

const LanguageWidget = ({ locale }: { locale: "en" | "bn" }) => {
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
    <div className="widget-language col-md-6" aria-busy={isPending}>
      <h6>Language</h6>
      <ul>
        {LOCALE_OPTIONS.map((opt) => (
          <li key={opt.code} className={opt.code === locale ? "actived" : ""}>
            <a
              href="#"
              aria-current={opt.code === locale ? "true" : undefined}
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
    </div>
  )
}

/* ----------------------------- Header ----------------------------- */

const HelendoHeader = ({
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
  // Which offcanvas li.has-children is expanded (one at a time, like the
  // template's slideUp of sibling sub-menus).
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null)
  // Sticky state uses the template's own class name ("is-sticky").
  const [isSticky, setIsSticky] = useState(false)
  const [term, setTerm] = useState("")
  const [overlayTerm, setOverlayTerm] = useState("")
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const stickyRef = useRef<HTMLElement | null>(null)
  const overlayInputRef = useRef<HTMLInputElement | null>(null)

  // topbar is accepted for chrome-contract parity with CignetHeader;
  // the Helendo design has no topbar strip so nothing renders from it
  // (FALLBACK_TOPBAR documents the expected shape).
  const hd = header ?? FALLBACK_HEADER

  /* Sticky header — same behavior as the template's assets/js/main.js:
     add "is-sticky" once scrolled past the header height, remove it
     before that. The wrapper height is locked so nothing jumps when
     .header-sticky goes position:fixed. */
  useEffect(() => {
    const onScrollOrResize = () => {
      const sticky = stickyRef.current
      const wrapper = wrapperRef.current
      if (!sticky || !wrapper) {
        return
      }
      const headerHeight = sticky.offsetHeight
      wrapper.style.height = `${headerHeight}px`
      setIsSticky(window.scrollY >= headerHeight)
    }
    onScrollOrResize()
    window.addEventListener("scroll", onScrollOrResize, { passive: true })
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [])

  /* Body scroll lock — the template adds "no-overflow" to <body> while
     the offcanvas or the search overlay is open. */
  useEffect(() => {
    const locked = menuOpen || searchOpen
    document.body.classList.toggle("no-overflow", locked)
    return () => {
      document.body.classList.remove("no-overflow")
    }
  }, [menuOpen, searchOpen])

  /* Escape closes the offcanvas and the search overlay. */
  useEffect(() => {
    if (!menuOpen && !searchOpen) {
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [menuOpen, searchOpen])

  /* Focus the overlay search field when the overlay opens. */
  useEffect(() => {
    if (searchOpen) {
      overlayInputRef.current?.focus()
    }
  }, [searchOpen])

  const closeMenu = () => {
    setMenuOpen(false)
    setOpenSubmenu(null)
  }

  const submitSearch = (raw: string, after?: () => void) => {
    const q = raw.trim()
    if (!q) {
      return
    }
    router.push(`/${countryCode}${hd.search.action}${encodeURIComponent(q)}`)
    after?.()
  }

  const toggleSubmenu = (key: string) => {
    setOpenSubmenu((open) => (open === key ? null : key))
  }

  /* Offcanvas nav items — same DYNAMIC_CATEGORIES_TOKEN handling as
     CignetHeader: the token expands to flat top-level category links
     (item.limit ?? 3); items with children_dynamic render as
     li.has-children with a categories ul.sub-menu. */
  const renderMenuItem = (item: HeaderMenuItem, i: number) => {
    if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
      const limit = item.limit ?? 3
      return categories.slice(0, limit).map((c) => (
        <li key={c.id}>
          <LocalizedClientLink
            href={`/categories/${c.handle}`}
            onClick={closeMenu}
          >
            <span>{c.name}</span>
          </LocalizedClientLink>
        </li>
      ))
    }

    if (item.children_dynamic) {
      const key = `m-${i}`
      const open = openSubmenu === key
      return (
        <li key={key} className={`has-children${open ? " active" : ""}`}>
          {/* main.js prepends this expander span to li.has-children */}
          <span
            className="menu-expand"
            role="button"
            tabIndex={0}
            aria-label={`${open ? "Collapse" : "Expand"} ${item.label} submenu`}
            aria-expanded={open}
            onClick={() => toggleSubmenu(key)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                toggleSubmenu(key)
              }
            }}
          >
            <i></i>
          </span>
          <LocalizedClientLink href={item.href ?? "/store"} onClick={closeMenu}>
            {item.label}
          </LocalizedClientLink>
          {/* The template hides sub-menus with jQuery slideUp (not CSS),
              so open state is controlled by conditional rendering. */}
          {open && (
            <ul className="sub-menu">
              <li>
                <LocalizedClientLink
                  href={item.href ?? "/store"}
                  onClick={closeMenu}
                >
                  <span>All Products</span>
                </LocalizedClientLink>
              </li>
              {categories.slice(0, item.children_dynamic.limit).map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink
                    href={`/categories/${c.handle}`}
                    onClick={closeMenu}
                  >
                    <span>{c.name}</span>
                  </LocalizedClientLink>
                </li>
              ))}
            </ul>
          )}
        </li>
      )
    }

    return (
      <li key={`m-${i}`}>
        <LocalizedClientLink href={item.href ?? "#"} onClick={closeMenu}>
          <span>{item.label}</span>
        </LocalizedClientLink>
      </li>
    )
  }

  return (
    <div className="helendo-theme">
      {/* header area (standard non-absolute variant, shop-left-sidebar.html) */}
      <div className="header-area header-area--default" ref={wrapperRef}>
        {/* Header Bottom Wrap Start */}
        <header
          className={`header-area header_height-90 header-sticky${
            isSticky ? " is-sticky" : ""
          }`}
          ref={stickyRef}
        >
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-4 col-md-4 d-none d-md-block">
                {hd.search.enabled && (
                  <div className="header-left-search">
                    <form
                      className="header-search-box"
                      role="search"
                      onSubmit={(e) => {
                        e.preventDefault()
                        submitSearch(term)
                      }}
                    >
                      <input
                        className="search-field"
                        type="text"
                        placeholder={hd.search.placeholder}
                        aria-label="Search products"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                      />
                      <button
                        type="submit"
                        className="search-icon"
                        aria-label="Submit search"
                      >
                        <i className="icon-magnifier"></i>
                      </button>
                    </form>
                  </div>
                )}
              </div>

              <div className="col-lg-4 col-md-4 col-6">
                <div className="logo text-md-center">
                  <LocalizedClientLink href="/">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={hd.logo || FALLBACK_HEADER.logo} style={chromeLogoStyle(hd as any)}
                      alt={hd.logo_alt}
                    />
                  </LocalizedClientLink>
                </div>
              </div>

              <div className="col-lg-4 col-md-4 col-6">
                <div className="header-right-side text-right">
                  <div className="header-right-items d-none d-md-block">
                    <LocalizedClientLink
                      href={hd.icons.account}
                      aria-label="Account"
                    >
                      <i className="icon-user"></i>
                    </LocalizedClientLink>
                  </div>

                  <div className="header-right-items d-none d-md-block">
                    <LocalizedClientLink
                      href={hd.icons.wishlist}
                      className="header-cart"
                      aria-label="Wishlist"
                    >
                      <i className="icon-heart"></i>
                    </LocalizedClientLink>
                  </div>

                  <div className="header-right-items">
                    <LocalizedClientLink
                      href={hd.icons.cart}
                      className="header-cart"
                      aria-label="Cart"
                    >
                      <i className="icon-bag2"></i>
                      {cartCount > 0 && (
                        <span className="item-counter">{cartCount}</span>
                      )}
                    </LocalizedClientLink>
                  </div>

                  {hd.search.enabled && (
                    <div className="header-right-items d-block d-md-none">
                      <a
                        href="#"
                        className="search-icon"
                        id="search-overlay-trigger"
                        aria-label="Open search"
                        onClick={(e) => {
                          e.preventDefault()
                          setSearchOpen(true)
                        }}
                      >
                        <i className="icon-magnifier"></i>
                      </a>
                    </div>
                  )}

                  <div className="header-right-items">
                    <a
                      href="#"
                      className="mobile-navigation-icon"
                      id="mobile-menu-trigger"
                      role="button"
                      aria-label={menuOpen ? "Close menu" : "Open menu"}
                      aria-expanded={menuOpen}
                      onClick={(e) => {
                        e.preventDefault()
                        setMenuOpen((open) => !open)
                      }}
                    >
                      <i className="icon-menu"></i>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        {/* Header Bottom Wrap End */}
      </div>

      {/* mobile menu overlay — main.js toggles "active" on
          #mobile-menu-overlay; clicks outside __inner close it */}
      <div
        className={`mobile-menu-overlay${menuOpen ? " active" : ""}`}
        id="mobile-menu-overlay"
        onClick={closeMenu}
      >
        <div
          className="mobile-menu-overlay__inner"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mobile-menu-close-box text-left">
            <span
              className="mobile-navigation-close-icon"
              id="mobile-menu-close-trigger"
              role="button"
              tabIndex={0}
              aria-label="Close menu"
              onClick={closeMenu}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  closeMenu()
                }
              }}
            >
              <i className="icon-cross2"></i>
            </span>
          </div>

          <div className="mobile-menu-overlay__body">
            <div className="offcanvas-menu-header d-md-block d-none">
              <div className="helendo-language-currency row-flex row section-space--mb_60">
                <LanguageWidget locale={locale} />
              </div>
            </div>

            <nav className="offcanvas-navigation" aria-label="Main navigation">
              <ul>{hd.menu.map(renderMenuItem)}</ul>
            </nav>
          </div>
        </div>
      </div>
      {/* End of mobile menu overlay */}

      {/* search overlay — main.js toggles "active" on #search-overlay */}
      {hd.search.enabled && (
        <div
          className={`search-overlay${searchOpen ? " active" : ""}`}
          id="search-overlay"
          aria-hidden={!searchOpen}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="search-overlay__header"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="container">
              <div className="row align-items-center">
                <div className="col-lg-6 col-8">
                  <div className="search-title">
                    <h4 className="font-weight--normal">Search</h4>
                  </div>
                </div>
                <div className="col-md-6 ml-auto col-4">
                  <div className="search-content text-right">
                    <span
                      className="mobile-navigation-close-icon"
                      id="search-close-trigger"
                      role="button"
                      tabIndex={0}
                      aria-label="Close search"
                      onClick={() => setSearchOpen(false)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSearchOpen(false)
                        }
                      }}
                    >
                      <i className="icon-cross"></i>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="search-overlay__inner"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="search-overlay__body">
              <div className="search-overlay__form">
                <div className="container">
                  <div className="row">
                    <div className="col-lg-9 ml-auto mr-auto">
                      <form
                        role="search"
                        onSubmit={(e) => {
                          e.preventDefault()
                          submitSearch(overlayTerm, () => setSearchOpen(false))
                        }}
                      >
                        <div className="search-fields">
                          <input
                            ref={overlayInputRef}
                            type="text"
                            placeholder={hd.search.placeholder}
                            aria-label="Search products"
                            value={overlayTerm}
                            onChange={(e) => setOverlayTerm(e.target.value)}
                          />
                          <button
                            type="submit"
                            className="submit-button"
                            aria-label="Submit search"
                          >
                            <i className="icon-magnifier"></i>
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* End of search overlay */}
    </div>
  )
}

export default HelendoHeader
