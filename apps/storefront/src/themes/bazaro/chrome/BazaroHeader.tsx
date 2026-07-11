"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Bazaro chrome HEADER: the template's header area (aq-header-top-area */
/* + dark aq-header-bottom-area menu bar, index.html 1484-1998) rebuilt  */
/* in React. Accepts EXACTLY the same props as the Learts/Cignet/Shofy   */
/* headers so it is a drop-in replacement (the CMS settings interfaces   */
/* are re-declared here, copied from @lib/data/cms, so this file stays   */
/* self-sufficient).                                                     */
/*                                                                      */
/* Template JS is NOT loaded — everything main.js did with jQuery is     */
/* reimplemented here:                                                   */
/*  - search overlay: "opened" on .aq-search-wrap (+ .body-overlay)      */
/*  - mobile offcanvas: "opened" on .aq-offcanvas-wrap; the cloned       */
/*    mean-menu markup (li.active + .aq-menu-close + display-toggled     */
/*    .submenu) is rendered as React state instead                       */
/*  - language dropdown: "aq-lang-list-open" on the .aq-header-lang ul   */
/*  - data-bg-color / data-width attributes become inline styles         */
/*  - sticky-on-scroll: the template header has no JS sticky; a React    */
/*    scroll listener toggles the bridge sheet's own "sticky-on" class   */
/*    on the .bz-header-sticky top bar (static at rest)                  */
/* Desktop nav dropdowns are pure CSS in the template                    */
/* (.aq-header-dropdown nav ul li:hover > .aq-submenu) so no JS needed.  */
/* Class names and DOM structure mirror index.html so /bazaro/css/*.css  */
/* styles apply unchanged. The cartmini offcanvas is intentionally       */
/* dropped: the cart icon links to /cart with a live count.              */
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

// Supported content locales offered by the header/offcanvas language lists.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "Bangla" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// Fallback values mirror the CMS defaults so the header renders even if
// the store API / settings are unavailable. The logo default is the
// template's own asset (public/bazaro/img/logo).
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
  logo: "/bazaro/img/logo/logo.png",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "What are you looking for?",
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

/* ----------------------------- Icons ------------------------------ */
/* The template's own inline SVGs, copied from index.html verbatim.    */

const SearchIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
  >
    <path
      d="M18.7504 18.7499L14.4004 14.3999M16.75 8.75C16.75 13.1683 13.1683 16.75 8.75 16.75C4.33172 16.75 0.75 13.1683 0.75 8.75C0.75 4.33172 4.33172 0.75 8.75 0.75C13.1683 0.75 16.75 4.33172 16.75 8.75Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const AccountIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="17"
    height="20"
    viewBox="0 0 17 20"
    fill="none"
  >
    <path
      d="M16.212 18.75C16.212 15.267 12.747 12.45 8.481 12.45C4.215 12.45 0.75 15.267 0.75 18.75M12.9805 5.25C12.9805 7.73528 10.9657 9.75 8.48047 9.75C5.99519 9.75 3.98047 7.73528 3.98047 5.25C3.98047 2.76472 5.99519 0.75 8.48047 0.75C10.9657 0.75 12.9805 2.76472 12.9805 5.25Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const WishlistIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="21"
    height="20"
    viewBox="0 0 21 20"
    fill="none"
  >
    <path
      d="M6.50726 4.80303C5.44195 5.14334 4.68503 6.09974 4.59044 7.22502M10.4856 18.6038C12.6562 17.2679 14.6755 15.6957 16.5073 13.9152C17.7951 12.633 18.7756 11.0698 19.3735 9.3454C20.4494 6.00032 19.1927 2.17084 15.6755 1.03753C13.827 0.442448 11.8081 0.782566 10.2505 1.95149C8.69225 0.783989 6.67412 0.443991 4.82552 1.03753C1.30833 2.17084 0.0425004 6.00032 1.11845 9.3454C1.71636 11.0698 2.69679 12.633 3.98465 13.9152C5.81647 15.6957 7.83575 17.2679 10.0064 18.6038L10.2414 18.75L10.4856 18.6038Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="21"
    viewBox="0 0 20 21"
    fill="none"
  >
    <path
      d="M5.48681 5.07041C5.48681 2.68433 7.4211 0.750039 9.80717 0.750039C10.9562 0.74517 12.0598 1.1982 12.874 2.00895C13.6882 2.81971 14.1459 3.92139 14.1458 5.07041M6.84107 9.57384H6.88684M12.6721 9.57388H12.7179M5.62368 19.972H13.9715C17.0379 19.972 19.3903 18.8645 18.7221 14.4068L17.944 8.3656C17.5321 6.14134 16.1134 5.29008 14.8685 5.29008H4.69004C3.42688 5.29008 2.0905 6.20542 1.61453 8.3656L0.836493 14.4068C0.268988 18.361 2.55732 19.972 5.62368 19.972Z"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SearchSubmitIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 18 18"
    fill="none"
  >
    <path
      d="M13.6792 12.6197C13.3863 12.3268 12.9114 12.3268 12.6185 12.6197C12.3256 12.9126 12.3256 13.3875 12.6185 13.6804L13.1489 13.15L13.6792 12.6197ZM13.1489 13.15L12.6185 13.6804L16.2185 17.2803L16.7489 16.75L17.2792 16.2197L13.6792 12.6197L13.1489 13.15ZM15.1499 7.94997H15.8999C15.8999 3.55932 12.3406 0 7.94997 0V0.75V1.5C11.5122 1.5 14.3999 4.38775 14.3999 7.94997H15.1499ZM7.94997 0.75V0C3.55932 0 0 3.55932 0 7.94997H0.75H1.5C1.5 4.38775 4.38775 1.5 7.94997 1.5V0.75ZM0.75 7.94997H0C0 12.3406 3.55932 15.8999 7.94997 15.8999V15.1499V14.3999C4.38775 14.3999 1.5 11.5122 1.5 7.94997H0.75ZM7.94997 15.1499V15.8999C12.3406 15.8999 15.8999 12.3406 15.8999 7.94997H15.1499H14.3999C14.3999 11.5122 11.5122 14.3999 7.94997 14.3999V15.1499Z"
      fill="currentcolor"
    />
  </svg>
)

const SearchCloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 14 14"
    fill="none"
  >
    <path
      d="M12.75 0.75L0.75 12.75M0.75 0.75L12.75 12.75"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const OffcanvasCloseIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
  >
    <path
      d="M10.75 0.75L0.75 10.75"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M0.75 0.75L10.75 10.75"
      stroke="currentcolor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/* ------------------------- Language dropdown ---------------------- */
/* The template's aq-header-lang dropdown (main.js toggled              */
/* "aq-lang-list-open" on the <ul>). Switches the CMS content locale    */
/* exactly like the Cignet/Shofy language switchers (updateLocale +     */
/* refresh). Used in the header top bar (pos-left) and in the           */
/* offcanvas bottom (p-relative).                                       */

const LanguageDropdown = ({
  locale,
  className,
}: {
  locale: "en" | "bn"
  className: string
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current =
    LOCALE_OPTIONS.find((opt) => opt.code === locale)?.label ?? "English"

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
    <div className={`aq-header-top-menu-item aq-header-lang ${className}`}>
      <span
        className="aq-header-lang-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-busy={isPending}
        onClick={() => setOpen((x) => !x)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpen((x) => !x)
          }
        }}
      >
        {current}
      </span>
      <ul className={open ? "aq-lang-list-open" : undefined}>
        {LOCALE_OPTIONS.filter((opt) => opt.code !== locale).map((opt) => (
          <li key={opt.code}>
            <a
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

/* --------------------------- Search overlay ------------------------ */
/* The template's full-width aq-search-area slide-down, opened by       */
/* main.js with the "opened" class; submits to the store search route   */
/* like the Cignet/Shofy headers. The dummy "Recently Viewed Products"  */
/* grid is dropped; "Popular Searches" become live category links.      */

const SearchOverlay = ({
  open,
  action,
  placeholder,
  categories,
  onClose,
}: {
  open: boolean
  action: string
  placeholder: string
  categories: HttpTypes.StoreProductCategory[]
  onClose: () => void
}) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }
  const [term, setTerm] = useState("")
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (!q) {
      return
    }
    router.push(`/${countryCode}${action}${encodeURIComponent(q)}`)
    onClose()
  }

  const quickLinks = categories.slice(0, 4)

  return (
    <div
      className={`aq-search-wrap aq-search-area${open ? " opened" : ""}`}
      aria-hidden={!open}
    >
      <div
        className="aq-search-close"
        role="button"
        tabIndex={0}
        aria-label="Close search"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <SearchCloseIcon />
      </div>
      <div className="aq-search-inner-wrap">
        <div className="container">
          <div className="row">
            <div className="col-xl-12">
              <form onSubmit={submit}>
                <div className="aq-search-input p-relative mb-60">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={placeholder}
                    aria-label="Search products"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                  <button
                    type="submit"
                    className="aq-search-input-btn"
                    aria-label="Submit search"
                  >
                    <SearchSubmitIcon />
                  </button>
                </div>
              </form>
            </div>
          </div>
          {quickLinks.length > 0 && (
            <div className="row">
              <div className="col-xl-12">
                <div className="aq-search-cat-wrap mb-30">
                  <h4 className="aq-search-cat-title mb-35">
                    Popular Searches
                  </h4>
                  <div className="aq-search-cat">
                    {quickLinks.map((c) => (
                      <LocalizedClientLink
                        key={c.id}
                        href={`/categories/${c.handle}`}
                        onClick={onClose}
                      >
                        {c.name}
                      </LocalizedClientLink>
                    ))}
                    <LocalizedClientLink href="/store" onClick={onClose}>
                      All Products
                    </LocalizedClientLink>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* --------------------------- Desktop nav -------------------------- */
/* Dropdowns are pure CSS in the template                              */
/* (.aq-header-dropdown nav ul li:hover > .aq-submenu), so submenu     */
/* items only need the template's li.has-dropdown + ul.aq-submenu      */
/* structure. The template's mega menus are demo showcases and are     */
/* intentionally replaced by plain submenus.                           */

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
          <li key={`m-${i}`} className="has-dropdown">
            <LocalizedClientLink href={item.href ?? "#"}>
              {item.label}
            </LocalizedClientLink>
            <ul className="aq-submenu submenu">
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

/* ------------------- Offcanvas expandable menu item ----------------- */
/* Mirrors the markup main.js generated for the cloned offcanvas menu:  */
/* li.has-dropdown gets an appended button.aq-menu-close, "active" on   */
/* the li and a display-toggled .submenu.                               */

const OffcanvasMenuItem = ({
  label,
  href,
  subItems,
  onNavigate,
}: {
  label: string
  href: string
  subItems?: { label: string; href: string }[]
  onNavigate: () => void
}) => {
  const [expanded, setExpanded] = useState(false)

  if (!subItems?.length) {
    return (
      <li>
        <LocalizedClientLink href={href} onClick={onNavigate}>
          {label}
        </LocalizedClientLink>
      </li>
    )
  }

  return (
    <li className={`has-dropdown${expanded ? " active" : ""}`}>
      <LocalizedClientLink href={href} onClick={onNavigate}>
        {label}
      </LocalizedClientLink>
      <button
        type="button"
        className="aq-menu-close"
        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        aria-expanded={expanded}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setExpanded((x) => !x)
        }}
      ></button>
      <ul
        className="aq-submenu submenu"
        style={{ display: expanded ? "block" : "none" }}
      >
        {subItems.map((child, i) => (
          <li key={i}>
            <LocalizedClientLink href={child.href} onClick={onNavigate}>
              {child.label}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </li>
  )
}

/* ----------------------------- Offcanvas --------------------------- */
/* The template's aq-offcanvas-wrap: logo + close on top, the mobile    */
/* menu (cloned by main.js in the template, rendered as React state     */
/* here), Login/Wishlist buttons and the language switcher below.       */

const Offcanvas = ({
  open,
  onClose,
  logo,
  logoAlt,
  menu,
  categories,
  mobileCategories,
  icons,
  locale,
}: {
  open: boolean
  onClose: () => void
  logo: string
  logoAlt: string
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
  mobileCategories: HttpTypes.StoreProductCategory[]
  icons: HeaderSettings["icons"]
  locale: "en" | "bn"
}) => (
  <div
    className={`aq-offcanvas-wrap${open ? " opened" : ""}`}
    aria-hidden={!open}
  >
    <div className="aq-offcanvas-top d-flex align-items-center justify-content-between">
      <div className="aq-offcanvas-logo">
        <LocalizedClientLink href="/" onClick={onClose}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt={logoAlt} style={{ width: 115 }} />
        </LocalizedClientLink>
      </div>
      <div
        className="aq-offcanvas-close"
        role="button"
        tabIndex={0}
        aria-label="Close menu"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClose()
          }
        }}
      >
        <span>
          <OffcanvasCloseIcon />
        </span>
      </div>
    </div>
    <div className="aq-offcanvas-menu-wrap">
      <div className="aq-offcanvas-menu">
        <nav>
          <ul>
            {menu.map((item, i) => {
              if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
                return mobileCategories
                  .slice(0, item.limit ?? 3)
                  .map((c) => (
                    <OffcanvasMenuItem
                      key={c.id}
                      label={c.name}
                      href={`/categories/${c.handle}`}
                      onNavigate={onClose}
                    />
                  ))
              }

              const subItems = item.children_dynamic
                ? [
                    { label: "All Products", href: item.href ?? "/store" },
                    ...categories
                      .slice(0, item.children_dynamic.limit)
                      .map((c) => ({
                        label: c.name,
                        href: `/categories/${c.handle}`,
                      })),
                  ]
                : undefined

              return (
                <OffcanvasMenuItem
                  key={`mm-${i}`}
                  label={item.label}
                  href={item.href ?? "#"}
                  subItems={subItems}
                  onNavigate={onClose}
                />
              )
            })}
            <li>
              <LocalizedClientLink href={icons.cart} onClick={onClose}>
                Cart
              </LocalizedClientLink>
            </li>
          </ul>
        </nav>
      </div>
    </div>
    <div className="aq-offcanvas-bottom">
      <div className="aq-offcanvas-btn-wrap d-flex justify-content-between align-items-center">
        <LocalizedClientLink
          className="aq-offcanvas-btn"
          href={icons.account}
          onClick={onClose}
        >
          Login
        </LocalizedClientLink>
        <LocalizedClientLink
          className="aq-offcanvas-btn btn-black-bg"
          href={icons.wishlist}
          onClick={onClose}
        >
          Wishlist
        </LocalizedClientLink>
      </div>
      <div className="d-flex align-items-center justify-content-between">
        <LanguageDropdown locale={locale} className="p-relative" />
      </div>
    </div>
  </div>
)

/* ----------------------------- Header ----------------------------- */

const BazaroHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Sticky state uses the bridge sheet's "sticky-on" class (the template
  // ships no sticky header of its own; static at rest per the playbook).
  const [stuck, setStuck] = useState(false)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER
  const mobileLimit = hd.mobile_menu_categories?.limit ?? null
  const mobileCategories =
    mobileLimit == null ? categories : categories.slice(0, mobileLimit)

  /* Sticky top bar: lock the host height so nothing jumps when the bar
     goes position:fixed, then stick past 400px of scroll. */
  useEffect(() => {
    const onScrollOrResize = () => {
      const bar = barRef.current
      const host = hostRef.current
      if (!bar || !host) {
        return
      }
      host.style.height = `${bar.offsetHeight}px`
      setStuck(window.scrollY > 400)
    }
    onScrollOrResize()
    window.addEventListener("scroll", onScrollOrResize, { passive: true })
    window.addEventListener("resize", onScrollOrResize)
    return () => {
      window.removeEventListener("scroll", onScrollOrResize)
      window.removeEventListener("resize", onScrollOrResize)
    }
  }, [])

  /* Escape closes every overlay (offcanvas / search). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const closeOverlays = () => {
    setMenuOpen(false)
    setSearchOpen(false)
  }

  return (
    <div className="bazaro-theme">
      {/* header area start */}
      <header>
        <div ref={hostRef}>
          <div
            ref={barRef}
            className={`aq-header-top-area aq-header-top-bdr bz-header-sticky${
              stuck ? " sticky-on" : ""
            }`}
          >
            <div className="container container-1830">
              <div className="row align-items-center">
                <div className="col-4">
                  {/* Language switcher + topbar links (the template's dummy
                      currency dropdown slot carries the CMS topbar links) */}
                  {tb.enabled && (
                    <div className="aq-header-top-left-options d-none d-xl-flex align-items-center">
                      <LanguageDropdown locale={locale} className="pos-left" />
                      {tb.links.map((link, i) => (
                        <div
                          className="aq-header-top-menu-item pos-left"
                          key={i}
                        >
                          {link.href.startsWith("/") ? (
                            <LocalizedClientLink href={link.href}>
                              {link.label}
                            </LocalizedClientLink>
                          ) : (
                            <a href={link.href}>{link.label}</a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Mobile hamburger (template markup, React state) */}
                  <div className="aq-header-bar-wrap d-xl-none">
                    <button
                      type="button"
                      className="aq-header-bar aq-offcanvas-toggle"
                      aria-label={menuOpen ? "Close menu" : "Open menu"}
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen(true)}
                    >
                      <span></span>
                      <span></span>
                      <span></span>
                    </button>
                  </div>
                </div>

                <div className="col-4">
                  {/* Logo (data-width=120 becomes an inline style) */}
                  <div className="aq-header-logo text-center pt-15 pb-15">
                    <LocalizedClientLink href="/">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={hd.logo} style={chromeLogoStyle(hd as any)}
                        alt={hd.logo_alt}
                        style={{ width: 120 }}
                      />
                    </LocalizedClientLink>
                  </div>
                </div>

                <div className="col-4">
                  {/* Search / account / wishlist / cart actions */}
                  <div className="aq-header-right-options text-end">
                    <ul>
                      {hd.search.enabled && (
                        <li className="aq-header-top-search">
                          <button
                            type="button"
                            className="aq-search-toggle"
                            aria-label="Search"
                            onClick={() => setSearchOpen(true)}
                          >
                            <i>
                              <SearchIcon />
                            </i>
                          </button>
                        </li>
                      )}
                      <li className="aq-header-top-account d-none d-md-inline-block">
                        <LocalizedClientLink
                          href={hd.icons.account}
                          aria-label="Account"
                        >
                          <i>
                            <AccountIcon />
                          </i>
                        </LocalizedClientLink>
                      </li>
                      <li className="aq-header-top-wishlist d-none d-md-inline-block">
                        <LocalizedClientLink
                          href={hd.icons.wishlist}
                          aria-label="Wishlist"
                        >
                          <i>
                            <WishlistIcon />
                          </i>
                        </LocalizedClientLink>
                      </li>
                      <li className="aq-header-top-cart">
                        <LocalizedClientLink
                          href={hd.icons.cart}
                          aria-label="Cart"
                        >
                          {cartCount > 0 && (
                            <span className="count-box">{cartCount}</span>
                          )}
                          <i>
                            <CartIcon />
                          </i>
                        </LocalizedClientLink>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dark desktop menu bar (data-bg-color becomes an inline style) */}
        <div
          className="aq-header-bottom-area d-none d-xl-block p-relative"
          style={{ backgroundColor: "var(--aq-common-black, #141414)" }}
        >
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-12">
                <div className="aq-header-menu aq-header-dropdown text-center">
                  <nav>
                    <DesktopNav menu={hd.menu} categories={categories} />
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* header area end */}

      {/* search overlay ("opened" class like main.js) */}
      <SearchOverlay
        open={searchOpen}
        action={hd.search.action}
        placeholder={hd.search.placeholder}
        categories={categories}
        onClose={() => setSearchOpen(false)}
      />

      {/* mobile offcanvas ("opened" class like main.js) */}
      <Offcanvas
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        logo={hd.logo}
        logoAlt={hd.logo_alt}
        menu={hd.menu}
        categories={categories}
        mobileCategories={mobileCategories}
        icons={hd.icons}
        locale={locale}
      />

      {/* body overlay (closes whichever overlay is open) */}
      <div
        className={`body-overlay${menuOpen || searchOpen ? " opened" : ""}`}
        onClick={closeOverlays}
      ></div>
    </div>
  )
}

export default BazaroHeader
