"use client"

import { useEffect, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Shofy chrome HEADER: the template's header area (header top +        */
/* header main + header bottom, header-style-1/primary from             */
/* index.html) rebuilt in React. Accepts EXACTLY the same props as the  */
/* Learts/Aurora/Cignet headers so it is a drop-in replacement (the     */
/* CMS settings interfaces are re-declared here, copied from            */
/* @lib/data/cms, so this file stays self-sufficient).                  */
/*                                                                     */
/* Template JS is NOT loaded — everything main.js did with jQuery is    */
/* reimplemented here:                                                  */
/*  - sticky header: adds the template's own "header-sticky-2" class    */
/*    to #header-sticky-2 (.tp-header-sticky-area) past 100px scroll    */
/*  - offcanvas: "offcanvas-opened" on .offcanvas__area + "opened" on   */
/*    .body-overlay, with the cloned mobile menus rendered as React     */
/*    state-driven markup (dropdown-toggle-btn / expanded /             */
/*    dropdown-opened classes, exactly what main.js generated)          */
/*  - search: "opened" on .tp-search-area (+ overlay)                   */
/*  - topbar language dropdown: "tp-lang-list-open" on the list         */
/*  - "All Departments" category menu: display toggle on its <ul>       */
/* Desktop nav dropdowns are pure CSS in the template                   */
/* (.main-menu > nav > ul > li:hover > .tp-submenu) so no JS is needed. */
/* Class names and DOM structure mirror index.html so /shofy/css/*.css  */
/* styles apply unchanged. The mini-cart drawer is intentionally        */
/* dropped: the cart icon links to /cart with a live count.             */
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

// Supported content locales offered by the topbar/offcanvas language lists.
const LOCALE_OPTIONS: { code: "en" | "bn"; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "Bangla" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// Fallback values mirror the CMS defaults so the header renders even if
// the store API / settings are unavailable. The logo default is the
// template's own asset (public/shofy/img/logo).
const FALLBACK_TOPBAR: TopbarSettings = {
  message: "FREE Express Shipping On Orders $59+",
  enabled: true,
  language_label: "English",
  currency_label: "BDT",
  links: [
    { icon: "fa-map-marker-alt", label: "Store Location", href: "#" },
    { icon: "fa-truck", label: "Order Status", href: "/account" },
  ],
}

const FALLBACK_HEADER: HeaderSettings = {
  logo: "/shofy/img/logo/logo.svg",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "Search for Products...",
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

const ShippingIcon = () => (
  <svg
    width="22"
    height="19"
    viewBox="0 0 22 19"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14.6364 1H1V12.8182H14.6364V1Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14.6364 5.54545H18.2727L21 8.27273V12.8182H14.6364V5.54545Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.0909 17.3636C6.3461 17.3636 7.36363 16.3461 7.36363 15.0909C7.36363 13.8357 6.3461 12.8182 5.0909 12.8182C3.83571 12.8182 2.81818 13.8357 2.81818 15.0909C2.81818 16.3461 3.83571 17.3636 5.0909 17.3636Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16.9091 17.3636C18.1643 17.3636 19.1818 16.3461 19.1818 15.0909C19.1818 13.8357 18.1643 12.8182 16.9091 12.8182C15.6539 12.8182 14.6364 13.8357 14.6364 15.0909C14.6364 16.3461 15.6539 17.3636 16.9091 17.3636Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19 19L14.65 14.65"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const UserIcon = () => (
  <svg
    width="17"
    height="21"
    viewBox="0 0 17 21"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle
      cx="8.57894"
      cy="5.77803"
      r="4.77803"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.00002 17.2014C0.998732 16.8655 1.07385 16.5337 1.2197 16.2311C1.67736 15.3158 2.96798 14.8307 4.03892 14.611C4.81128 14.4462 5.59431 14.336 6.38217 14.2815C7.84084 14.1533 9.30793 14.1533 10.7666 14.2815C11.5544 14.3367 12.3374 14.4468 13.1099 14.611C14.1808 14.8307 15.4714 15.27 15.9291 16.2311C16.2224 16.8479 16.2224 17.564 15.9291 18.1808C15.4714 19.1419 14.1808 19.5812 13.1099 19.7918C12.3384 19.9634 11.5551 20.0766 10.7666 20.1304C9.57937 20.2311 8.38659 20.2494 7.19681 20.1854C6.92221 20.1854 6.65677 20.1854 6.38217 20.1304C5.59663 20.0773 4.81632 19.9641 4.04807 19.7918C2.96798 19.5812 1.68652 19.1419 1.2197 18.1808C1.0746 17.8747 0.999552 17.5401 1.00002 17.2014Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const WishlistIcon = () => (
  <svg
    width="22"
    height="20"
    viewBox="0 0 22 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.239 18.8538C13.4096 17.5179 15.4289 15.9456 17.2607 14.1652C18.5486 12.8829 19.529 11.3198 20.1269 9.59539C21.2029 6.25031 19.9461 2.42083 16.4289 1.28752C14.5804 0.692435 12.5616 1.03255 11.0039 2.20148C9.44567 1.03398 7.42754 0.693978 5.57894 1.28752C2.06175 2.42083 0.795919 6.25031 1.87187 9.59539C2.46978 11.3198 3.45021 12.8829 4.73806 14.1652C6.56988 15.9456 8.58917 17.5179 10.7598 18.8538L10.9949 19L11.239 18.8538Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.26062 5.05302C6.19531 5.39332 5.43839 6.34973 5.3438 7.47501"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CartIcon = () => (
  <svg
    width="21"
    height="22"
    viewBox="0 0 21 22"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M6.48626 20.5H14.8341C17.9004 20.5 20.2528 19.3924 19.5847 14.9348L18.8066 8.89359C18.3947 6.66934 16.976 5.81808 15.7311 5.81808H5.55262C4.28946 5.81808 2.95308 6.73341 2.4771 8.89359L1.69907 14.9348C1.13157 18.889 3.4199 20.5 6.48626 20.5Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M6.34902 5.5984C6.34902 3.21232 8.28331 1.27803 10.6694 1.27803V1.27803C11.8184 1.27316 12.922 1.72619 13.7362 2.53695C14.5504 3.3477 15.0081 4.44939 15.0081 5.5984V5.5984"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7.70365 10.1018H7.74942"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5343 10.1018H13.5801"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const HamburgerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="30"
    height="16"
    viewBox="0 0 30 16"
  >
    <rect x="10" width="20" height="2" fill="currentColor" />
    <rect x="5" y="7" width="25" height="2" fill="currentColor" />
    <rect x="10" y="14" width="20" height="2" fill="currentColor" />
  </svg>
)

const DepartmentsIcon = () => (
  <svg
    width="18"
    height="14"
    viewBox="0 0 18 14"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M0 1C0 0.447715 0.447715 0 1 0H15C15.5523 0 16 0.447715 16 1C16 1.55228 15.5523 2 15 2H1C0.447715 2 0 1.55228 0 1ZM0 7C0 6.44772 0.447715 6 1 6H17C17.5523 6 18 6.44772 18 7C18 7.55228 17.5523 8 17 8H1C0.447715 8 0 7.55228 0 7ZM1 12C0.447715 12 0 12.4477 0 13C0 13.5523 0.447715 14 1 14H11C11.5523 14 12 13.5523 12 13C12 12.4477 11.5523 12 11 12H1Z"
      fill="currentColor"
    />
  </svg>
)

const HotlineIcon = () => (
  <svg
    width="21"
    height="20"
    viewBox="0 0 21 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1.96977 3.24859C2.26945 2.75144 3.92158 0.946726 5.09889 1.00121C5.45111 1.03137 5.76246 1.24346 6.01544 1.49057H6.01641C6.59631 2.05874 8.26011 4.203 8.35352 4.65442C8.58411 5.76158 7.26378 6.39979 7.66756 7.5157C8.69698 10.0345 10.4707 11.8081 12.9908 12.8365C14.1058 13.2412 14.7441 11.9219 15.8513 12.1515C16.3028 12.2459 18.4482 13.9086 19.0155 14.4894V14.4894C19.2616 14.7414 19.4757 15.0537 19.5049 15.4059C19.5487 16.6463 17.6319 18.3207 17.2583 18.5347C16.3767 19.1661 15.2267 19.1544 13.8246 18.5026C9.91224 16.8749 3.65985 10.7408 2.00188 6.68096C1.3675 5.2868 1.32469 4.12906 1.96977 3.24859Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.936 1.23685C16.4432 1.62622 19.2124 4.39253 19.6065 7.89874"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12.936 4.59337C14.6129 4.92021 15.9231 6.23042 16.2499 7.90726"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const CloseIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M11 1L1 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1 1L11 11"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/* ------------------------- Language dropdown ---------------------- */
/* The template's topbar tp-header-lang dropdown (main.js toggled       */
/* "tp-lang-list-open" on the <ul>). Switches the CMS content locale    */
/* exactly like the Cignet/Aurora language switchers (updateLocale +    */
/* refresh).                                                            */

const TopbarLanguage = ({ locale }: { locale: "en" | "bn" }) => {
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
    <div className="tp-header-top-menu-item tp-header-lang">
      <span
        className="tp-header-lang-toggle"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-busy={isPending}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setOpen((o) => !o)
          }
        }}
      >
        {current}
      </span>
      <ul className={open ? "tp-lang-list-open" : undefined}>
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

/* --------------------------- Search area --------------------------- */
/* The template's full-screen tp-search-area, opened by main.js with    */
/* the "opened" class; submits to the store search route like the       */
/* Cignet/Aurora headers.                                               */

const SearchArea = ({
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (!q) {
      return
    }
    router.push(`/${countryCode}${action}${encodeURIComponent(q)}`)
    onClose()
  }

  const quickLinks = categories.slice(0, 5)

  return (
    <section
      className={`tp-search-area${open ? " opened" : ""}`}
      aria-hidden={!open}
    >
      <div className="container">
        <div className="row">
          <div className="col-xl-12">
            <div className="tp-search-form">
              <div className="tp-search-close text-center mb-20">
                <button
                  type="button"
                  className="tp-search-close-btn"
                  aria-label="Close search"
                  onClick={onClose}
                ></button>
              </div>
              <form onSubmit={submit}>
                <div className="tp-search-input mb-10">
                  <input
                    type="text"
                    placeholder={placeholder}
                    aria-label="Search products"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                  <button type="submit" aria-label="Submit search">
                    <SearchIcon />
                  </button>
                </div>
                {quickLinks.length > 0 && (
                  <div className="tp-search-category">
                    <span>Search by : </span>
                    {quickLinks.map((c, i) => (
                      <LocalizedClientLink
                        key={c.id}
                        href={`/categories/${c.handle}`}
                        onClick={onClose}
                      >
                        {c.name}
                        {i < quickLinks.length - 1 ? ", " : ""}
                      </LocalizedClientLink>
                    ))}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------- Desktop nav -------------------------- */
/* Dropdowns are pure CSS in the template                              */
/* (.main-menu > nav > ul > li:hover > .tp-submenu), so submenu items   */
/* only need the template's li.has-dropdown + ul.tp-submenu structure.  */

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
            <ul className="tp-submenu">
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
/* Mirrors the markup main.js generated for the cloned mobile menus:    */
/* a .dropdown-toggle-btn appended inside the anchor, "expanded" on the */
/* anchor + "dropdown-opened" on the button, and a display-toggled      */
/* .tp-submenu.                                                         */

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
    <li className="has-dropdown">
      <LocalizedClientLink
        href={href}
        className={expanded ? "expanded" : undefined}
        onClick={onNavigate}
      >
        {label}
        <button
          type="button"
          className={`dropdown-toggle-btn${expanded ? " dropdown-opened" : ""}`}
          aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={expanded}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setExpanded((x) => !x)
          }}
        >
          <i className="fa-solid fa-angle-right"></i>
        </button>
      </LocalizedClientLink>
      <ul
        className="tp-submenu"
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
/* The template's offcanvas__area: logo, "All Categories" toggle with   */
/* the category list, the mobile main menu, contact button and the      */
/* language switcher — all state-driven React.                          */

const Offcanvas = ({
  open,
  onClose,
  logo,
  logoAlt,
  menu,
  categories,
  mobileCategories,
  locale,
}: {
  open: boolean
  onClose: () => void
  logo: string
  logoAlt: string
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
  mobileCategories: HttpTypes.StoreProductCategory[]
  locale: "en" | "bn"
}) => {
  const router = useRouter()
  const [catOpen, setCatOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const currentLang =
    LOCALE_OPTIONS.find((opt) => opt.code === locale)?.label ?? "English"

  const selectLang = (code: "en" | "bn") => {
    setLangOpen(false)
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
      className={`offcanvas__area offcanvas__radius${
        open ? " offcanvas-opened" : ""
      }`}
      aria-hidden={!open}
    >
      <div className="offcanvas__wrapper">
        <div className="offcanvas__close">
          <button
            type="button"
            className="offcanvas__close-btn offcanvas-close-btn"
            aria-label="Close menu"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="offcanvas__content">
          <div className="offcanvas__top mb-70 d-flex justify-content-between align-items-center">
            <div className="offcanvas__logo logo">
              <LocalizedClientLink href="/" onClick={onClose}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt={logoAlt} />
              </LocalizedClientLink>
            </div>
          </div>

          {/* All Categories (the template cloned .tp-category-menu-content
              in here; rendered directly with live categories instead) */}
          <div className="offcanvas__category pb-40">
            <button
              type="button"
              className="tp-offcanvas-category-toggle"
              aria-expanded={catOpen}
              onClick={() => setCatOpen((x) => !x)}
            >
              <i className="fa-solid fa-bars"></i>
              All Categories
            </button>
            <div className="tp-category-mobile-menu">
              <nav
                className="tp-category-menu-content"
                style={{ display: catOpen ? "block" : "none" }}
              >
                <ul>
                  {mobileCategories.map((c) => (
                    <li key={c.id}>
                      <LocalizedClientLink
                        href={`/categories/${c.handle}`}
                        onClick={onClose}
                      >
                        {c.name}
                      </LocalizedClientLink>
                    </li>
                  ))}
                  <li>
                    <LocalizedClientLink href="/store" onClick={onClose}>
                      All Products
                    </LocalizedClientLink>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          {/* Mobile main menu (the template cloned .tp-main-menu-content
              in here via main.js; rendered as React state instead) */}
          <div className="tp-main-menu-mobile fix d-lg-none mb-40">
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
              </ul>
            </nav>
          </div>

          <div className="offcanvas__btn">
            <LocalizedClientLink
              href="/contact-us"
              className="tp-btn-2 tp-btn-border-2"
              onClick={onClose}
            >
              Contact Us
            </LocalizedClientLink>
          </div>
        </div>
        <div className="offcanvas__bottom">
          <div className="offcanvas__footer d-flex align-items-center justify-content-between">
            <div className="offcanvas__select language">
              <div className="offcanvas__lang d-flex align-items-center">
                <div className="offcanvas__lang-img mr-15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/shofy/img/icon/language-flag.png" alt="" />
                </div>
                <div className="offcanvas__lang-wrapper">
                  <span
                    className="offcanvas__lang-selected-lang tp-lang-toggle"
                    role="button"
                    tabIndex={0}
                    aria-expanded={langOpen}
                    aria-busy={isPending}
                    onClick={() => setLangOpen((x) => !x)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setLangOpen((x) => !x)
                      }
                    }}
                  >
                    {currentLang}
                  </span>
                  <ul
                    className={`offcanvas__lang-list tp-lang-list${
                      langOpen ? " tp-lang-list-open" : ""
                    }`}
                  >
                    {LOCALE_OPTIONS.filter((opt) => opt.code !== locale).map(
                      (opt) => (
                        <li key={opt.code} onClick={() => selectLang(opt.code)}>
                          {opt.label}
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- Header ----------------------------- */

const ShofyHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode: string }

  const [offcanvasOpen, setOffcanvasOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [deptOpen, setDeptOpen] = useState(false)
  // Sticky state uses the template's own class name ("header-sticky-2").
  const [stuck, setStuck] = useState(false)
  const [term, setTerm] = useState("")
  const [searchCategory, setSearchCategory] = useState("")

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER
  const mobileLimit = hd.mobile_menu_categories?.limit ?? null
  const mobileCategories =
    mobileLimit == null ? categories : categories.slice(0, mobileLimit)

  /* Sticky header — same behavior as the template's main.js:
     #header-sticky-2 (.tp-header-sticky-area) gets "header-sticky-2"
     past 100px of scroll, which fades the fixed bar in. */
  useEffect(() => {
    const onScroll = () => {
      setStuck(window.scrollY >= 100)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  /* Escape closes every overlay (offcanvas / search). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOffcanvasOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const closeOverlays = () => {
    setOffcanvasOpen(false)
    setSearchOpen(false)
  }

  /* Header search: term -> store search route; a picked category with no
     term -> that category's listing (the template's select is decorative,
     here it routes for real). */
  const submitHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = term.trim()
    if (q) {
      router.push(`/${countryCode}${hd.search.action}${encodeURIComponent(q)}`)
      return
    }
    if (searchCategory) {
      router.push(`/${countryCode}/categories/${searchCategory}`)
    }
  }

  return (
    <div className="shofy-theme">
      {/* header area start */}
      <header>
        <div className="tp-header-area p-relative z-index-11">
          {/* header top start */}
          {tb.enabled && (
            <div className="tp-header-top black-bg p-relative z-index-1 d-none d-md-block">
              <div className="container">
                <div className="row align-items-center">
                  <div className="col-md-6">
                    <div className="tp-header-welcome d-flex align-items-center">
                      <span>
                        <ShippingIcon />
                      </span>
                      <p>{tb.message}</p>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="tp-header-top-right d-flex align-items-center justify-content-end">
                      <div className="tp-header-top-menu d-flex align-items-center justify-content-end">
                        {tb.links.map((link, i) => (
                          <div className="tp-header-top-menu-item" key={i}>
                            {link.href.startsWith("/") ? (
                              <LocalizedClientLink
                                href={link.href}
                                style={{ color: "var(--tp-common-white)" }}
                              >
                                {link.label}
                              </LocalizedClientLink>
                            ) : (
                              <a
                                href={link.href}
                                style={{ color: "var(--tp-common-white)" }}
                              >
                                {link.label}
                              </a>
                            )}
                          </div>
                        ))}
                        <TopbarLanguage locale={locale} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* header main start */}
          <div className="tp-header-main tp-header-sticky">
            <div className="container">
              <div className="row align-items-center">
                <div className="col-xl-2 col-lg-2 col-md-4 col-6">
                  <div className="logo">
                    <LocalizedClientLink href="/">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={hd.logo} style={chromeLogoStyle(hd as any)} alt={hd.logo_alt} />
                    </LocalizedClientLink>
                  </div>
                </div>
                {hd.search.enabled && (
                  <div className="col-xl-6 col-lg-7 d-none d-lg-block">
                    <div className="tp-header-search pl-70">
                      <form onSubmit={submitHeaderSearch}>
                        <div className="tp-header-search-wrapper d-flex align-items-center">
                          <div className="tp-header-search-box">
                            <input
                              type="text"
                              placeholder={hd.search.placeholder}
                              aria-label="Search products"
                              value={term}
                              onChange={(e) => setTerm(e.target.value)}
                            />
                          </div>
                          <div className="tp-header-search-category">
                            {/* The template swapped this <select> for a
                                jQuery nice-select clone; the raw select is
                                styled to match instead. */}
                            <select
                              aria-label="Search category"
                              value={searchCategory}
                              onChange={(e) =>
                                setSearchCategory(e.target.value)
                              }
                              style={{
                                border: 0,
                                height: 46,
                                lineHeight: "46px",
                                fontSize: 14,
                                color: "var(--tp-common-black)",
                                paddingRight: 20,
                                backgroundColor: "transparent",
                                outline: "none",
                                cursor: "pointer",
                              }}
                            >
                              <option value="">Select Category</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.handle}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="tp-header-search-btn">
                            <button type="submit" aria-label="Submit search">
                              <SearchIcon />
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
                <div className="col-xl-4 col-lg-3 col-md-8 col-6">
                  <div className="tp-header-main-right d-flex align-items-center justify-content-end">
                    <div className="tp-header-login d-none d-lg-block">
                      <LocalizedClientLink
                        href={hd.icons.account}
                        className="d-flex align-items-center"
                      >
                        <div className="tp-header-login-icon">
                          <span>
                            <UserIcon />
                          </span>
                        </div>
                        <div className="tp-header-login-content d-none d-xl-block">
                          <span>Hello, Sign In</span>
                          <h5 className="tp-header-login-title">
                            Your Account
                          </h5>
                        </div>
                      </LocalizedClientLink>
                    </div>
                    <div className="tp-header-action d-flex align-items-center ml-50">
                      <div className="tp-header-action-item d-none d-lg-block">
                        <button
                          type="button"
                          className="tp-header-action-btn tp-search-open-btn"
                          aria-label="Search"
                          onClick={() => setSearchOpen(true)}
                        >
                          <SearchIcon />
                        </button>
                      </div>
                      <div className="tp-header-action-item d-none d-lg-block">
                        <LocalizedClientLink
                          href={hd.icons.wishlist}
                          className="tp-header-action-btn"
                          aria-label="Wishlist"
                        >
                          <WishlistIcon />
                        </LocalizedClientLink>
                      </div>
                      <div className="tp-header-action-item">
                        <LocalizedClientLink
                          href={hd.icons.cart}
                          className="tp-header-action-btn"
                          aria-label="Cart"
                        >
                          <CartIcon />
                          {cartCount > 0 && (
                            <span className="tp-header-action-badge">
                              {cartCount}
                            </span>
                          )}
                        </LocalizedClientLink>
                      </div>
                      <div className="tp-header-action-item d-lg-none">
                        <button
                          type="button"
                          className="tp-header-action-btn tp-offcanvas-open-btn"
                          aria-label="Open menu"
                          onClick={() => setOffcanvasOpen(true)}
                        >
                          <HamburgerIcon />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* header bottom start */}
          <div className="tp-header-bottom tp-header-bottom-border d-none d-lg-block">
            <div className="container">
              <div className="tp-mega-menu-wrapper p-relative">
                <div className="row align-items-center">
                  <div className="col-xl-3 col-lg-3">
                    <div className="tp-header-category tp-category-menu tp-header-category-toggle">
                      <button
                        type="button"
                        className="tp-category-menu-btn tp-category-menu-toggle"
                        aria-expanded={deptOpen}
                        onClick={() => setDeptOpen((x) => !x)}
                      >
                        <span>
                          <DepartmentsIcon />
                        </span>
                        All Departments
                      </button>
                      <nav className="tp-category-menu-content">
                        <ul style={{ display: deptOpen ? "block" : "none" }}>
                          {categories.map((c) =>
                            c.category_children?.length ? (
                              <li key={c.id} className="has-dropdown">
                                <LocalizedClientLink
                                  href={`/categories/${c.handle}`}
                                  onClick={() => setDeptOpen(false)}
                                >
                                  {c.name}
                                </LocalizedClientLink>
                                <ul className="tp-submenu">
                                  {c.category_children.map((child) => (
                                    <li key={child.id}>
                                      <LocalizedClientLink
                                        href={`/categories/${child.handle}`}
                                        onClick={() => setDeptOpen(false)}
                                      >
                                        {child.name}
                                      </LocalizedClientLink>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ) : (
                              <li key={c.id}>
                                <LocalizedClientLink
                                  href={`/categories/${c.handle}`}
                                  onClick={() => setDeptOpen(false)}
                                >
                                  {c.name}
                                </LocalizedClientLink>
                              </li>
                            )
                          )}
                          <li>
                            <LocalizedClientLink
                              href="/store"
                              onClick={() => setDeptOpen(false)}
                            >
                              All Products
                            </LocalizedClientLink>
                          </li>
                        </ul>
                      </nav>
                    </div>
                  </div>
                  <div className="col-xl-6 col-lg-6">
                    <div className="main-menu menu-style-1">
                      <nav className="tp-main-menu-content">
                        <DesktopNav menu={hd.menu} categories={categories} />
                      </nav>
                    </div>
                  </div>
                  <div className="col-xl-3 col-lg-3">
                    <div className="tp-header-contact d-flex align-items-center justify-content-end">
                      <div className="tp-header-contact-icon">
                        <span>
                          <HotlineIcon />
                        </span>
                      </div>
                      <div className="tp-header-contact-content">
                        <h5>Need help?</h5>
                        <p>
                          <LocalizedClientLink href="/contact-us">
                            Contact Support
                          </LocalizedClientLink>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>
      {/* header area end */}

      {/* sticky header (fades in past 100px, exactly like main.js) */}
      <div
        id="header-sticky-2"
        className={`tp-header-sticky-area${stuck ? " header-sticky-2" : ""}`}
      >
        <div className="container">
          <div className="tp-mega-menu-wrapper p-relative">
            <div className="row align-items-center">
              <div className="col-xl-3 col-lg-3 col-md-3 col-6">
                <div className="logo">
                  <LocalizedClientLink href="/">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={hd.logo} style={chromeLogoStyle(hd as any)} alt={hd.logo_alt} />
                  </LocalizedClientLink>
                </div>
              </div>
              <div className="col-xl-6 col-lg-6 col-md-6 d-none d-md-block">
                <div className="tp-header-sticky-menu main-menu menu-style-1">
                  <nav>
                    <DesktopNav menu={hd.menu} categories={categories} />
                  </nav>
                </div>
              </div>
              <div className="col-xl-3 col-lg-3 col-md-3 col-6">
                <div className="tp-header-action d-flex align-items-center justify-content-end ml-50">
                  <div className="tp-header-action-item d-none d-lg-block">
                    <LocalizedClientLink
                      href={hd.icons.wishlist}
                      className="tp-header-action-btn"
                      aria-label="Wishlist"
                    >
                      <WishlistIcon />
                    </LocalizedClientLink>
                  </div>
                  <div className="tp-header-action-item">
                    <LocalizedClientLink
                      href={hd.icons.cart}
                      className="tp-header-action-btn"
                      aria-label="Cart"
                    >
                      <CartIcon />
                      {cartCount > 0 && (
                        <span className="tp-header-action-badge">
                          {cartCount}
                        </span>
                      )}
                    </LocalizedClientLink>
                  </div>
                  <div className="tp-header-action-item d-lg-none">
                    <button
                      type="button"
                      className="tp-header-action-btn tp-offcanvas-open-btn"
                      aria-label="Open menu"
                      onClick={() => setOffcanvasOpen(true)}
                    >
                      <HamburgerIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* offcanvas area (React state instead of main.js class toggles) */}
      <Offcanvas
        open={offcanvasOpen}
        onClose={() => setOffcanvasOpen(false)}
        logo={hd.logo}
        logoAlt={hd.logo_alt}
        menu={hd.menu}
        categories={categories}
        mobileCategories={mobileCategories}
        locale={locale}
      />
      <div
        className={`body-overlay${
          offcanvasOpen || searchOpen ? " opened" : ""
        }`}
        onClick={closeOverlays}
      ></div>

      {/* mobile bottom menu bar (template used flaticon-*; that webfont
          is not shipped, so Font Awesome equivalents are used) */}
      <div id="tp-bottom-menu-sticky" className="tp-mobile-menu d-lg-none">
        <div className="container">
          <div className="row row-cols-5">
            <div className="col">
              <div className="tp-mobile-item text-center">
                <LocalizedClientLink
                  href="/store"
                  className="tp-mobile-item-btn"
                >
                  <i className="fa-solid fa-store"></i>
                  <span>Store</span>
                </LocalizedClientLink>
              </div>
            </div>
            <div className="col">
              <div className="tp-mobile-item text-center">
                <button
                  type="button"
                  className="tp-mobile-item-btn tp-search-open-btn"
                  onClick={() => setSearchOpen(true)}
                >
                  <i className="fa-solid fa-magnifying-glass"></i>
                  <span>Search</span>
                </button>
              </div>
            </div>
            <div className="col">
              <div className="tp-mobile-item text-center">
                <LocalizedClientLink
                  href={hd.icons.wishlist}
                  className="tp-mobile-item-btn"
                >
                  <i className="fa-solid fa-heart"></i>
                  <span>Wishlist</span>
                </LocalizedClientLink>
              </div>
            </div>
            <div className="col">
              <div className="tp-mobile-item text-center">
                <LocalizedClientLink
                  href={hd.icons.account}
                  className="tp-mobile-item-btn"
                >
                  <i className="fa-solid fa-user"></i>
                  <span>Account</span>
                </LocalizedClientLink>
              </div>
            </div>
            <div className="col">
              <div className="tp-mobile-item text-center">
                <button
                  type="button"
                  className="tp-mobile-item-btn tp-offcanvas-open-btn"
                  onClick={() => setOffcanvasOpen(true)}
                >
                  <i className="fa-solid fa-bars"></i>
                  <span>Menu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* search area (full-screen overlay, "opened" class like main.js) */}
      <SearchArea
        open={searchOpen}
        action={hd.search.action}
        placeholder={hd.search.placeholder}
        categories={categories}
        onClose={() => setSearchOpen(false)}
      />
    </div>
  )
}

export default ShofyHeader
