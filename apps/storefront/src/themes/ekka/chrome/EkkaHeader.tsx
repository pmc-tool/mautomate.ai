"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Ekka chrome HEADER: the template's ec-header (header-top strip +     */
/* logo/search/buttons row + ec-main-menu nav row + ec-mobile-menu      */
/* side panel) rebuilt in React. Accepts EXACTLY the same props as the  */
/* Learts/Cignet headers so it is a drop-in replacement (the CMS        */
/* settings interfaces are re-declared here, copied from @lib/data/cms, */
/* so this file stays self-sufficient).                                 */
/*                                                                     */
/* Template JS is NOT loaded — everything it did with jQuery/Bootstrap  */
/* is reimplemented here:                                               */
/*  - sticky nav: toggles the template's own "menu_fixed" class on the  */
/*    #ec-main-menu-desk .sticky-nav row (main.js behavior)             */
/*  - Bootstrap dropdowns (user menu, topbar language): React state     */
/*    toggling the .show class, with outside-click close                */
/*  - ec-mobile-menu side canvas: React state toggling "ec-open" plus   */
/*    the overlay and a body scroll lock                                */
/*  - search: the inline form submits to the store search route         */
/* Desktop nav dropdowns are pure CSS (:hover) in the template, so they */
/* need no JS. Class names and DOM mirror index.html so                 */
/* /ekka/css/style.css applies unchanged.                               */
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

// Supported content locales offered by the topbar language dropdown.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "Bangla" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// The template's own header-top social icons (topbar settings carry no
// social list, so these are the Ekka presentational defaults).
const HEADER_SOCIAL: { className: string; icon: string; label: string }[] = [
  { className: "hdr-facebook", icon: "ecicon eci-facebook", label: "Facebook" },
  { className: "hdr-twitter", icon: "ecicon eci-twitter", label: "Twitter" },
  {
    className: "hdr-instagram",
    icon: "ecicon eci-instagram",
    label: "Instagram",
  },
  { className: "hdr-linkedin", icon: "ecicon eci-linkedin", label: "LinkedIn" },
]

// Fallback values mirror the CMS defaults so the header renders even if
// the store API / settings are unavailable. The logo default is the
// template's own asset (public/ekka/images).
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
  logo: "/ekka/images/logo/logo.png",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "Search products...",
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

/* ---------------------- Outside-click dropdown -------------------- */
/* Bootstrap's data-bs-toggle="dropdown" does not run here, so each     */
/* dropdown manages its own open state and closes on outside clicks.   */

const useDropdown = () => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  return { open, setOpen, ref }
}

/* ------------------------- Language dropdown ---------------------- */
/* Rendered inside .header-top-lan-curr so the template's topbar        */
/* dropdown styling applies. Switches the CMS content locale exactly   */
/* like the Cignet LanguageSelect (updateLocale + refresh). The dummy  */
/* currency dropdown from the template is intentionally omitted.       */

const LanguageDropdown = ({ locale }: { locale: "en" | "bn" }) => {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { open, setOpen, ref } = useDropdown()

  const active =
    LOCALE_OPTIONS.find((opt) => opt.code === locale) ?? LOCALE_OPTIONS[0]

  const select = (code: "en" | "bn") => {
    setOpen(false)
    if (code === locale || isPending) {
      return
    }
    startTransition(async () => {
      await updateLocale(code)
      router.refresh()
    })
  }

  return (
    <div className="header-top-lan dropdown" ref={ref}>
      <button
        type="button"
        className="dropdown-toggle text-upper"
        aria-haspopup="true"
        aria-expanded={open}
        aria-busy={isPending}
        onClick={() => setOpen(!open)}
      >
        {active.label}{" "}
        <i className="ecicon eci-caret-down" aria-hidden="true"></i>
      </button>
      <ul className={`dropdown-menu${open ? " show" : ""}`}>
        {LOCALE_OPTIONS.map((opt) => (
          <li key={opt.code} className={opt.code === locale ? "active" : ""}>
            <a
              className="dropdown-item"
              href="#"
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

/* --------------------------- User dropdown ------------------------ */
/* The template's ec-header-user Bootstrap dropdown (Register /         */
/* Checkout / Login), re-pointed at the store's real routes.            */

const UserDropdown = ({ accountHref }: { accountHref: string }) => {
  const { open, setOpen, ref } = useDropdown()

  const items = [
    { label: "Register", href: accountHref },
    { label: "Checkout", href: "/cart" },
    { label: "Login", href: accountHref },
  ]

  return (
    <div className="ec-header-user dropdown" ref={ref}>
      <button
        type="button"
        className="dropdown-toggle"
        aria-label="Account"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <i className="fi-rr-user"></i>
      </button>
      <ul className={`dropdown-menu dropdown-menu-right${open ? " show" : ""}`}>
        {items.map((item, i) => (
          <li key={i}>
            <LocalizedClientLink
              className="dropdown-item"
              href={item.href}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* --------------------------- Search form -------------------------- */
/* The template's inline .header-search form; submits to the store      */
/* search route (mirrors the Cignet SearchModal routing).               */

const HeaderSearch = ({
  action,
  placeholder,
}: {
  action: string
  placeholder: string
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
  }

  return (
    <div className="header-search">
      <form className="ec-btn-group-form" onSubmit={submit}>
        <input
          className="form-control ec-search-bar"
          placeholder={placeholder}
          type="text"
          aria-label="Search products"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <button className="submit" type="submit" aria-label="Submit search">
          <i className="fi-rr-search"></i>
        </button>
      </form>
    </div>
  )
}

/* --------------------------- Header buttons ----------------------- */
/* The user / wishlist / cart button cluster, used in both the desktop  */
/* row and the header-top responsive slot.                              */

const HeaderButtons = ({
  cartCount,
  icons,
  onOpenMenu,
}: {
  cartCount: number
  icons: HeaderSettings["icons"]
  onOpenMenu?: () => void
}) => (
  <div className="ec-header-bottons">
    <UserDropdown accountHref={icons.account} />
    <LocalizedClientLink
      href={icons.wishlist}
      className="ec-header-btn ec-header-wishlist"
      aria-label="Wishlist"
    >
      <div className="header-icon">
        <i className="fi-rr-heart"></i>
      </div>
    </LocalizedClientLink>
    <LocalizedClientLink
      href={icons.cart}
      className="ec-header-btn"
      aria-label="Cart"
    >
      <div className="header-icon">
        <i className="fi-rr-shopping-bag"></i>
      </div>
      {cartCount > 0 && (
        <span className="ec-header-count cart-count-lable">{cartCount}</span>
      )}
    </LocalizedClientLink>
    {onOpenMenu && (
      <a
        href="#ec-mobile-menu"
        className="ec-header-btn ec-side-toggle d-lg-none"
        aria-label="Open menu"
        onClick={(e) => {
          e.preventDefault()
          onOpenMenu()
        }}
      >
        <i className="fi fi-rr-menu-burger"></i>
      </a>
    )}
  </div>
)

/* --------------------------- Desktop nav -------------------------- */
/* Dropdowns are pure CSS in the template                               */
/* (.ec-main-menu ul li.dropdown:hover .sub-menu) so submenu items only */
/* need the template's li.dropdown > ul.sub-menu structure.             */

const DesktopNav = ({
  menu,
  categories,
}: {
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
}) => (
  <ul>
    {menu.map((item, i) => {
      if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
        const limit = item.limit ?? 3
        return categories.slice(0, limit).map((c) => (
          <li key={c.id}>
            <LocalizedClientLink href={`/categories/${c.handle}`}>
              {c.name}
            </LocalizedClientLink>
          </li>
        ))
      }

      if (item.children_dynamic) {
        return (
          <li key={`m-${i}`} className="dropdown">
            <LocalizedClientLink href={item.href ?? "#"}>
              {item.label}
            </LocalizedClientLink>
            <ul className="sub-menu">
              <li>
                <LocalizedClientLink href={item.href ?? "/store"}>
                  All Products
                </LocalizedClientLink>
              </li>
              {categories.slice(0, item.children_dynamic.limit).map((c) => (
                <li key={c.id}>
                  <LocalizedClientLink href={`/categories/${c.handle}`}>
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
          <LocalizedClientLink href={item.href ?? "#"}>
            {item.label}
          </LocalizedClientLink>
        </li>
      )
    })}
  </ul>
)

/* ----------------------------- Header ----------------------------- */

const EkkaHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const [menuOpen, setMenuOpen] = useState(false)
  // Sticky nav uses the template's own "menu_fixed" class.
  const [stuck, setStuck] = useState(false)
  const navHostRef = useRef<HTMLDivElement | null>(null)
  const navRef = useRef<HTMLDivElement | null>(null)

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER
  const mobileLimit = hd.mobile_menu_categories?.limit ?? null
  const mobileCategories =
    mobileLimit == null ? categories : categories.slice(0, mobileLimit)

  /* Sticky main menu — same behavior as the template's main.js:
     - lock the host row height so nothing jumps when .sticky-nav goes
       position:fixed (menu_fixed)
     - fix the nav once the header has scrolled out of view */
  useEffect(() => {
    const onScrollOrResize = () => {
      const nav = navRef.current
      const host = navHostRef.current
      if (!nav || !host) {
        return
      }
      host.style.height = `${nav.offsetHeight}px`
      setStuck(window.scrollY > 250)
    }
    onScrollOrResize()
    window.addEventListener("scroll", onScrollOrResize, { passive: true })
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [])

  /* Body scroll lock while the mobile menu side canvas is open. */
  useEffect(() => {
    if (!menuOpen) {
      return
    }
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="ekka-theme">
      <header className="ec-header">
        {/* Ec Header Top Start */}
        {tb.enabled && (
          <div className="header-top">
            <div className="container">
              <div className="row align-items-center">
                {/* Header Top social Start */}
                <div className="col text-left header-top-left d-none d-lg-block">
                  <div className="header-top-social">
                    <span className="social-text text-upper">
                      Follow us on:
                    </span>
                    <ul className="mb-0">
                      {HEADER_SOCIAL.map((s, i) => (
                        <li key={i} className="list-inline-item">
                          <a
                            className={s.className}
                            href="#"
                            aria-label={s.label}
                          >
                            <i className={s.icon}></i>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                {/* Header Top social End */}

                {/* Header Top Message Start */}
                <div className="col text-center header-top-center">
                  <div className="header-top-message text-upper">
                    {tb.message}
                  </div>
                </div>
                {/* Header Top Message End */}

                {/* Header Top Language (currency dropdown omitted — no
                    store equivalent) */}
                <div className="col header-top-right d-none d-lg-block">
                  <div className="header-top-lan-curr d-flex justify-content-end">
                    <LanguageDropdown locale={locale} />
                  </div>
                </div>

                {/* Header Top responsive Action */}
                <div className="col d-lg-none">
                  <HeaderButtons
                    cartCount={cartCount}
                    icons={hd.icons}
                    onOpenMenu={() => setMenuOpen(true)}
                  />
                </div>
                {/* Header Top responsive Action End */}
              </div>
            </div>
          </div>
        )}
        {/* Topbar disabled: the mobile user/cart/menu buttons live in the
            header-top strip, so keep a mobile-only strip for them. */}
        {!tb.enabled && (
          <div className="header-top d-lg-none">
            <div className="container">
              <div className="row align-items-center">
                <div className="col">
                  <HeaderButtons
                    cartCount={cartCount}
                    icons={hd.icons}
                    onOpenMenu={() => setMenuOpen(true)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Ec Header Top End */}

        {/* Ec Header Bottom Start */}
        <div className="ec-header-bottom d-none d-lg-block">
          <div className="container position-relative">
            <div className="row">
              <div className="ec-flex">
                {/* Ec Header Logo Start */}
                <div className="align-self-center">
                  <div className="header-logo">
                    <LocalizedClientLink href="/">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={hd.logo} style={chromeLogoStyle(hd as any)} alt={hd.logo_alt} />
                    </LocalizedClientLink>
                  </div>
                </div>
                {/* Ec Header Logo End */}

                {/* Ec Header Search Start */}
                <div className="align-self-center">
                  {hd.search.enabled && (
                    <HeaderSearch
                      action={hd.search.action}
                      placeholder={hd.search.placeholder}
                    />
                  )}
                </div>
                {/* Ec Header Search End */}

                {/* Ec Header Button Start */}
                <div className="align-self-center">
                  <HeaderButtons cartCount={cartCount} icons={hd.icons} />
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Ec Header Bottom End */}

        {/* Header responsive Bottom Start */}
        <div className="ec-header-bottom d-lg-none">
          <div className="container position-relative">
            <div className="row">
              {/* Ec Header Logo Start */}
              <div className="col">
                <div className="header-logo">
                  <LocalizedClientLink href="/">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hd.logo} style={chromeLogoStyle(hd as any)} alt={hd.logo_alt} />
                  </LocalizedClientLink>
                </div>
              </div>
              {/* Ec Header Logo End */}

              {/* Ec Header Search Start */}
              <div className="col">
                {hd.search.enabled && (
                  <HeaderSearch
                    action={hd.search.action}
                    placeholder={hd.search.placeholder}
                  />
                )}
              </div>
              {/* Ec Header Search End */}
            </div>
          </div>
        </div>
        {/* Header responsive Bottom End */}

        {/* EC Main Menu Start */}
        <div ref={navHostRef}>
          <div
            id="ec-main-menu-desk"
            ref={navRef}
            className={`d-none d-lg-block sticky-nav${
              stuck ? " menu_fixed" : ""
            }`}
          >
            <div className="container position-relative">
              <div className="row">
                <div className="col-md-12 align-self-center">
                  <div className="ec-main-menu">
                    <DesktopNav menu={hd.menu} categories={categories} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Ec Main Menu End */}

        {/* ekka Mobile Menu Start */}
        <div
          id="ec-mobile-menu"
          className={`ec-side-cart ec-mobile-menu${menuOpen ? " ec-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <div className="ec-menu-title">
            <span className="menu_title">My Menu</span>
            <button
              className="ec-close"
              aria-label="Close menu"
              onClick={closeMenu}
            >
              ×
            </button>
          </div>
          <div className="ec-menu-inner">
            <div className="ec-menu-content">
              <ul>
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
                  <LocalizedClientLink href={hd.icons.cart} onClick={closeMenu}>
                    Cart
                  </LocalizedClientLink>
                </li>
              </ul>
            </div>
            <div className="header-res-lan-curr">
              {/* Social Start */}
              <div className="header-res-social">
                <div className="header-top-social">
                  <ul className="mb-0">
                    {HEADER_SOCIAL.map((s, i) => (
                      <li key={i} className="list-inline-item">
                        <a
                          className={s.className}
                          href="#"
                          aria-label={s.label}
                        >
                          <i className={s.icon}></i>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {/* Social End */}
            </div>
          </div>
        </div>
        {/* ekka mobile Menu End */}
      </header>

      {/* Side canvas overlay (template shows it via jQuery; here it only
          renders while the mobile menu is open, above page content but
          below the .ec-side-cart panel at z-index 1000) */}
      {menuOpen && (
        <div
          className="ec-side-cart-overlay"
          style={{ display: "block", zIndex: 999 }}
          onClick={closeMenu}
        ></div>
      )}
    </div>
  )
}

export default EkkaHeader
