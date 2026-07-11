"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { chromeLogoStyle } from "@lib/util/logo-style"
import { HttpTypes } from "@medusajs/types"
import { useParams, useRouter } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { updateLocale } from "@lib/data/locale-actions"

/* ------------------------------------------------------------------ */
/* Rokon chrome HEADER: the template's header__section (topbar +        */
/* main__header + offcanvas mobile menu + sticky mobile toolbar +       */
/* predictive search box) rebuilt in React. Accepts EXACTLY the same    */
/* props as the Learts/Cignet/Shofy headers so it is a drop-in          */
/* replacement (the CMS settings interfaces are re-declared here,       */
/* copied from @lib/data/cms, so this file stays self-sufficient).      */
/*                                                                     */
/* Template JS is NOT loaded — everything assets/js/script.js did is    */
/* reimplemented here:                                                  */
/*  - sticky header: adds the template's own "sticky" class to          */
/*    .header__sticky once scrollY passes the header's top offset       */
/*  - offcanvas mobile menu: "open" on .offcanvas-header +              */
/*    "mobile_menu_open" on <body> (the template's overlay is a         */
/*    body::before tied to that class); submenu toggles render the      */
/*    .offcanvas__sub_menu_toggle button script.js used to inject       */
/*  - predictive search: "active" on .predictive__search--box +         */
/*    "predictive__search--box_active" on <body>                        */
/*  - topbar/offcanvas language dropdowns: "active" class toggles,      */
/*    wired to the real CMS locale (updateLocale + router.refresh)      */
/* Desktop nav dropdowns are pure CSS in the template                   */
/* (.header__menu--items:hover .header__sub--menu) so no JS is needed.  */
/* Class names and DOM structure mirror index.html so /rokon/css/*.css  */
/* styles apply unchanged. The minicart drawer is intentionally         */
/* dropped: the cart icons link to /cart with a live count. The         */
/* currency dropdown is rendered as a static label (no fake switcher).  */
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
  { code: "en", label: "ENG" },
  { code: "bn", label: "BAN" },
]

// Sentinel label that expands to top-level category links.
const DYNAMIC_CATEGORIES_TOKEN = "__dynamic_categories__"

// Fallback values mirror the CMS defaults so the header renders even if
// the store API / settings are unavailable. The logo default is the
// template's own asset (public/rokon/img/logo).
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
  logo: "/rokon/img/logo/nav-logo.webp",
  logo_alt: "Forever Finds",
  search: {
    enabled: true,
    placeholder: "Search Here",
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

const PhoneIcon = () => (
  <svg
    className="header__contact--info__icon"
    xmlns="http://www.w3.org/2000/svg"
    width="15.797"
    height="20.05"
    viewBox="0 0 512 512"
  >
    <path
      d="M451 374c-15.88-16-54.34-39.35-73-48.76-24.3-12.24-26.3-13.24-45.4.95-12.74 9.47-21.21 17.93-36.12 14.75s-47.31-21.11-75.68-49.39-47.34-61.62-50.53-76.48 5.41-23.23 14.79-36c13.22-18 12.22-21 .92-45.3-8.81-18.9-32.84-57-48.9-72.8C119.9 44 119.9 47 108.83 51.6A160.15 160.15 0 0083 65.37C67 76 58.12 84.83 51.91 98.1s-9 44.38 23.07 102.64 54.57 88.05 101.14 134.49S258.5 406.64 310.85 436c64.76 36.27 89.6 29.2 102.91 23s22.18-15 32.83-31a159.09 159.09 0 0013.8-25.8C465 391.17 468 391.17 451 374z"
      fill="currentColor"
      stroke="currentColor"
      strokeMiterlimit="10"
      strokeWidth="32"
    />
  </svg>
)

const MailIcon = () => (
  <svg
    className="header__contact--info__icon"
    xmlns="http://www.w3.org/2000/svg"
    width="20.57"
    height="13.13"
    viewBox="0 0 31.57 31.13"
  >
    <path
      d="M30.413,4H5.157C3.421,4,2.016,5.751,2.016,7.891L2,31.239c0,2.14,1.421,3.891,3.157,3.891H30.413c1.736,0,3.157-1.751,3.157-3.891V7.891C33.57,5.751,32.149,4,30.413,4Zm0,7.783L17.785,21.511,5.157,11.783V7.891l12.628,9.728L30.413,7.891Z"
      transform="translate(-2 -4)"
      fill="currentColor"
    ></path>
  </svg>
)

const CaretIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="11.797"
    height="9.05"
    viewBox="0 0 9.797 6.05"
  >
    <path
      d="M14.646,8.59,10.9,12.329,7.151,8.59,6,9.741l4.9,4.9,4.9-4.9Z"
      transform="translate(-6 -8.59)"
      fill="currentColor"
      opacity="0.7"
    />
  </svg>
)

const HamburgerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="ionicon offcanvas__header--menu__open--svg"
    viewBox="0 0 512 512"
  >
    <path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="32"
      d="M80 160h352M80 256h352M80 352h352"
    />
  </svg>
)

const SearchIcon = ({
  width = "26.51",
  height = "23.443",
  className,
}: {
  width?: string
  height?: string
  className?: string
}) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 512 512"
  >
    <path
      d="M221.09 64a157.09 157.09 0 10157.09 157.09A157.1 157.1 0 00221.09 64z"
      fill="none"
      stroke="currentColor"
      strokeMiterlimit="10"
      strokeWidth="32"
    />
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeMiterlimit="10"
      strokeWidth="32"
      d="M338.29 338.29L448 448"
    />
  </svg>
)

const UserIcon = ({
  width = "26.51",
  height = "23.443",
}: {
  width?: string
  height?: string
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 512 512"
  >
    <path
      d="M344 144c-3.92 52.87-44 96-88 96s-84.15-43.12-88-96c-4-55 35-96 88-96s92 42 88 96z"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="32"
    />
    <path
      d="M256 304c-87 0-175.3 48-191.64 138.6C62.39 453.52 68.57 464 80 464h352c11.44 0 17.62-10.48 15.65-21.4C431.3 352 343 304 256 304z"
      fill="none"
      stroke="currentColor"
      strokeMiterlimit="10"
      strokeWidth="32"
    />
  </svg>
)

const BagIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18.897"
    height="21.565"
    viewBox="0 0 18.897 21.565"
  >
    <path
      d="M16.84,8.082V6.091a4.725,4.725,0,1,0-9.449,0v4.725a.675.675,0,0,0,1.35,0V9.432h5.4V8.082h-5.4V6.091a3.375,3.375,0,0,1,6.75,0v4.691a.675.675,0,1,0,1.35,0V9.433h3.374V21.581H4.017V9.432H6.041V8.082H2.667V21.641a1.289,1.289,0,0,0,1.289,1.29h16.32a1.289,1.289,0,0,0,1.289-1.29V8.082Z"
      transform="translate(-2.667 -1.366)"
      fill="currentColor"
    />
  </svg>
)

const HomeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    width="21.51"
    height="21.443"
    viewBox="0 0 22 17"
  >
    <path
      fill="currentColor"
      d="M20.9141 7.93359c.1406.11719.2109.26953.2109.45703 0 .14063-.0469.25782-.1406.35157l-.3516.42187c-.1172.14063-.2578.21094-.4219.21094-.1406 0-.2578-.04688-.3515-.14062l-.9844-.77344V15c0 .3047-.1172.5625-.3516.7734-.2109.2344-.4687.3516-.7734.3516h-4.5c-.3047 0-.5742-.1172-.8086-.3516-.2109-.2109-.3164-.4687-.3164-.7734v-3.6562h-2.25V15c0 .3047-.11719.5625-.35156.7734-.21094.2344-.46875.3516-.77344.3516h-4.5c-.30469 0-.57422-.1172-.80859-.3516-.21094-.2109-.31641-.4687-.31641-.7734V8.46094l-.94922.77344c-.11719.09374-.24609.14062-.38672.14062-.16406 0-.30468-.07031-.42187-.21094l-.35157-.42187C.921875 8.625.875 8.50781.875 8.39062c0-.1875.070312-.33984.21094-.45703L9.73438.832031C10.1094.527344 10.5312.375 11 .375s.8906.152344 1.2656.457031l8.6485 7.101559zm-3.7266 6.50391V7.05469L11 1.99219l-6.1875 5.0625v7.38281h3.375v-3.6563c0-.3046.10547-.5624.31641-.7734.23437-.23436.5039-.35155.80859-.35155h3.375c.3047 0 .5625.11719.7734.35155.2344.211.3516.4688.3516.7734v3.6563h3.375z"
    ></path>
  </svg>
)

const GridIcon = () => (
  <svg
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    width="18.51"
    height="17.443"
    viewBox="0 0 448 512"
  >
    <path d="M416 32H32A32 32 0 0 0 0 64v384a32 32 0 0 0 32 32h384a32 32 0 0 0 32-32V64a32 32 0 0 0-32-32zm-16 48v152H248V80zm-200 0v152H48V80zM48 432V280h152v152zm200 0V280h152v152z"></path>
  </svg>
)

const CartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18.51"
    height="15.443"
    viewBox="0 0 18.51 15.443"
  >
    <path
      d="M79.963,138.379l-13.358,0-.56-1.927a.871.871,0,0,0-.6-.592l-1.961-.529a.91.91,0,0,0-.226-.03.864.864,0,0,0-.226,1.7l1.491.4,3.026,10.919a1.277,1.277,0,1,0,1.844,1.144.358.358,0,0,0,0-.049h6.163c0,.017,0,.034,0,.049a1.277,1.277,0,1,0,1.434-1.267c-1.531-.247-7.783-.55-7.783-.55l-.205-.8h7.8a.9.9,0,0,0,.863-.651l1.688-5.943h.62a.936.936,0,1,0,0-1.872Zm-9.934,6.474H68.568c-.04,0-.1.008-.125-.085-.034-.118-.082-.283-.082-.283l-1.146-4.037a.061.061,0,0,1,.011-.057.064.064,0,0,1,.053-.025h1.777a.064.064,0,0,1,.063.051l.969,4.34,0,.013a.058.058,0,0,1,0,.019A.063.063,0,0,1,70.03,144.853Zm3.731-4.41-.789,4.359a.066.066,0,0,1-.063.051h-1.1a.064.064,0,0,1-.063-.051l-.789-4.357a.064.064,0,0,1,.013-.055.07.07,0,0,1,.051-.025H73.7a.06.06,0,0,1,.051.025A.064.064,0,0,1,73.76,140.443Zm3.737,0L76.26,144.8a.068.068,0,0,1-.063.049H74.684a.063.063,0,0,1-.051-.025.064.064,0,0,1-.013-.055l.973-4.357a.066.066,0,0,1,.063-.051h1.777a.071.071,0,0,1,.053.025A.076.076,0,0,1,77.5,140.448Z"
      transform="translate(-62.393 -135.3)"
      fill="currentColor"
    />
  </svg>
)

const HeartIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18.541"
    height="15.557"
    viewBox="0 0 18.541 15.557"
  >
    <path
      d="M71.775,135.51a5.153,5.153,0,0,1,1.267-1.524,4.986,4.986,0,0,1,6.584.358,4.728,4.728,0,0,1,1.174,4.914,10.458,10.458,0,0,1-2.132,3.808,22.591,22.591,0,0,1-5.4,4.558c-.445.282-.9.549-1.356.812a.306.306,0,0,1-.254.013,25.491,25.491,0,0,1-6.279-4.8,11.648,11.648,0,0,1-2.52-4.009,4.957,4.957,0,0,1,.028-3.787,4.629,4.629,0,0,1,3.744-2.863,4.782,4.782,0,0,1,5.086,2.447c.013.019.025.034.057.076Z"
      transform="translate(-62.498 -132.915)"
      fill="currentColor"
    />
  </svg>
)

const CloseIcon = ({
  className,
  width = "40.51",
  height = "30.443",
}: {
  className?: string
  width?: string
  height?: string
}) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 512 512"
  >
    <path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="32"
      d="M368 368L144 144M368 144L144 368"
    />
  </svg>
)

/* -------------------------- Topbar link --------------------------- */
/* The template's header__contact--info list carries tel:/mailto:      */
/* items with inline phone/mail SVGs; CMS-configured links keep those  */
/* icons when their href is a tel:/mailto: URL.                        */

const TopbarLink = ({
  link,
}: {
  link: { icon: string; label: string; href: string }
}) => {
  const icon = link.href.startsWith("tel:") ? (
    <PhoneIcon />
  ) : link.href.startsWith("mailto:") ? (
    <MailIcon />
  ) : null

  return (
    <li className="header__contact--info__list text-white">
      {icon}
      {link.href.startsWith("/") ? (
        <LocalizedClientLink href={link.href}>{link.label}</LocalizedClientLink>
      ) : (
        <a href={link.href}>{link.label}</a>
      )}
    </li>
  )
}

/* ------------------------- Language dropdown ---------------------- */
/* The template's language__switcher dropdown (script.js toggled        */
/* "active" on the trigger + .dropdown__language). Switches the CMS     */
/* content locale exactly like the Cignet/Shofy language switchers      */
/* (updateLocale + refresh).                                            */

const TopbarLanguage = ({ locale }: { locale: "en" | "bn" }) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const current =
    LOCALE_OPTIONS.find((opt) => opt.code === locale)?.label ?? "ENG"

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
    <li className="language__currency--list">
      <a
        className={`language__switcher text-white${open ? " active" : ""}`}
        href="#"
        role="button"
        aria-expanded={open}
        aria-busy={isPending}
        onClick={(e) => {
          e.preventDefault()
          setOpen((x) => !x)
        }}
      >
        <span>{current}</span>
        <CaretIcon />
      </a>
      <div className={`dropdown__language${open ? " active" : ""}`}>
        <ul>
          {LOCALE_OPTIONS.filter((opt) => opt.code !== locale).map((opt) => (
            <li className="language__items" key={opt.code}>
              <a
                className="language__text"
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
    </li>
  )
}

/* --------------------------- Desktop nav -------------------------- */
/* Dropdowns are pure CSS in the template                              */
/* (.header__menu--items:hover .header__sub--menu), so submenu items   */
/* only need the template's li/ul structure.                           */

const DesktopNav = ({
  menu,
  categories,
}: {
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
}) => (
  <ul className="d-flex">
    {menu.map((item, i) => {
      if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
        const limit = item.limit ?? 3
        return categories.slice(0, limit).map((c) => (
          <li key={c.id} className="header__menu--items">
            <LocalizedClientLink
              className="header__menu--link"
              href={`/categories/${c.handle}`}
            >
              {c.name}
            </LocalizedClientLink>
          </li>
        ))
      }

      if (item.children_dynamic) {
        return (
          <li key={`m-${i}`} className="header__menu--items">
            <LocalizedClientLink
              className="header__menu--link"
              href={item.href ?? "#"}
            >
              {item.label} <span className="menu__plus--icon">+</span>
            </LocalizedClientLink>
            <ul className="header__sub--menu">
              <li className="header__sub--menu__items">
                <LocalizedClientLink
                  className="header__sub--menu__link"
                  href={item.href ?? "/store"}
                >
                  All Products
                </LocalizedClientLink>
              </li>
              {categories.slice(0, item.children_dynamic.limit).map((c) => (
                <li key={c.id} className="header__sub--menu__items">
                  <LocalizedClientLink
                    className="header__sub--menu__link"
                    href={`/categories/${c.handle}`}
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
        <li key={`m-${i}`} className="header__menu--items">
          <LocalizedClientLink
            className="header__menu--link"
            href={item.href ?? "#"}
          >
            {item.label}
          </LocalizedClientLink>
        </li>
      )
    })}
  </ul>
)

/* --------------------- Offcanvas expandable item ------------------- */
/* Mirrors the markup script.js generated for the mobile menu: an       */
/* injected .offcanvas__sub_menu_toggle button, "active" on the li +    */
/* toggle, and a display-toggled .offcanvas__sub_menu.                  */

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
      <li className="offcanvas__menu_li">
        <LocalizedClientLink
          className="offcanvas__menu_item"
          href={href}
          onClick={onNavigate}
        >
          {label}
        </LocalizedClientLink>
      </li>
    )
  }

  return (
    <li className={`offcanvas__menu_li${expanded ? " active" : ""}`}>
      <LocalizedClientLink
        className="offcanvas__menu_item"
        href={href}
        onClick={onNavigate}
      >
        {label}
      </LocalizedClientLink>
      <button
        type="button"
        className={`offcanvas__sub_menu_toggle${expanded ? " active" : ""}`}
        aria-label={expanded ? `Collapse ${label}` : `Expand ${label}`}
        aria-expanded={expanded}
        onClick={() => setExpanded((x) => !x)}
      ></button>
      <ul
        className="offcanvas__sub_menu"
        style={{ display: expanded ? "block" : "none" }}
      >
        {subItems.map((child, i) => (
          <li key={i} className="offcanvas__sub_menu_li">
            <LocalizedClientLink
              className="offcanvas__sub_menu_item"
              href={child.href}
              onClick={onNavigate}
            >
              {child.label}
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </li>
  )
}

/* ----------------------------- Offcanvas --------------------------- */
/* The template's .offcanvas-header mobile menu: logo + close button,   */
/* the main menu with expandable submenus, the account item and a       */
/* working language switcher (the currency dropdown is omitted — no     */
/* fake switchers).                                                     */

const OffcanvasMenu = ({
  open,
  onClose,
  logo,
  logoAlt,
  menu,
  categories,
  mobileCategories,
  accountHref,
  locale,
}: {
  open: boolean
  onClose: () => void
  logo: string
  logoAlt: string
  menu: HeaderMenuItem[]
  categories: HttpTypes.StoreProductCategory[]
  mobileCategories: HttpTypes.StoreProductCategory[]
  accountHref: string
  locale: "en" | "bn"
}) => {
  const router = useRouter()
  const [langOpen, setLangOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const currentLang =
    locale === "bn" ? "Bangla" : FALLBACK_TOPBAR.language_label

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
      className={`offcanvas-header${open ? " open" : ""}`}
      tabIndex={-1}
      aria-hidden={!open}
    >
      <div className="offcanvas__inner">
        <div className="offcanvas__logo">
          <LocalizedClientLink
            className="offcanvas__logo_link"
            href="/"
            onClick={onClose}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={logoAlt} />
          </LocalizedClientLink>
          <button
            type="button"
            className="offcanvas__close--btn"
            onClick={onClose}
          >
            close
          </button>
        </div>
        <nav className="offcanvas__menu">
          <ul className="offcanvas__menu_ul">
            {menu.map((item, i) => {
              if (item.label === DYNAMIC_CATEGORIES_TOKEN) {
                return mobileCategories.slice(0, item.limit ?? 3).map((c) => (
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
          <div className="offcanvas__account--items">
            <LocalizedClientLink
              className="offcanvas__account--items__btn d-flex align-items-center"
              href={accountHref}
              onClick={onClose}
            >
              <span className="offcanvas__account--items__icon">
                <UserIcon width="20.51" height="19.443" />
              </span>
              <span className="offcanvas__account--items__label">
                Login / Register
              </span>
            </LocalizedClientLink>
          </div>
          <div className="language__currency">
            <ul className="d-flex align-items-center">
              <li className="language__currency--list">
                <a
                  className={`offcanvas__language--switcher${
                    langOpen ? " active" : ""
                  }`}
                  href="#"
                  role="button"
                  aria-expanded={langOpen}
                  aria-busy={isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    setLangOpen((x) => !x)
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="language__switcher--icon__img"
                    src="/rokon/img/icon/language-icon.webp"
                    alt=""
                  />
                  <span>{currentLang}</span>
                  <CaretIcon />
                </a>
                <div
                  className={`offcanvas__dropdown--language${
                    langOpen ? " active" : ""
                  }`}
                >
                  <ul>
                    {LOCALE_OPTIONS.filter((opt) => opt.code !== locale).map(
                      (opt) => (
                        <li className="language__items" key={opt.code}>
                          <a
                            className="language__text"
                            href="#"
                            onClick={(e) => {
                              e.preventDefault()
                              selectLang(opt.code)
                            }}
                          >
                            {opt.code === "bn" ? "Bangla" : "English"}
                          </a>
                        </li>
                      )
                    )}
                  </ul>
                </div>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  )
}

/* ------------------------- Predictive search ----------------------- */
/* The template's .predictive__search--box, opened by script.js with    */
/* the "active" class (+ a body class for the overlay); submits to the  */
/* store search route like the Cignet/Shofy headers.                    */

const PredictiveSearch = ({
  open,
  action,
  placeholder,
  onClose,
}: {
  open: boolean
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
      className={`predictive__search--box${open ? " active" : ""}`}
      tabIndex={-1}
      aria-hidden={!open}
    >
      <div className="predictive__search--box__inner">
        <h2 className="predictive__search--title">Search Products</h2>
        <form className="predictive__search--form" onSubmit={submit}>
          <label>
            <input
              className="predictive__search--input"
              placeholder={placeholder}
              type="text"
              aria-label="Search products"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
          <button
            className="predictive__search--button"
            aria-label="search button"
            type="submit"
          >
            <SearchIcon
              className="header__search--button__svg"
              width="30.51"
              height="25.443"
            />
          </button>
        </form>
      </div>
      <button
        type="button"
        className="predictive__search--close__btn"
        aria-label="search close btn"
        onClick={onClose}
      >
        <CloseIcon className="predictive__search--close__icon" />
      </button>
    </div>
  )
}

/* ----------------------------- Header ----------------------------- */

const RokonHeader = ({
  cartCount,
  categories,
  topbar,
  header,
  locale = "en",
}: Props) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // Sticky state uses the template's own class name ("sticky").
  const [stuck, setStuck] = useState(false)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const spacerRef = useRef<HTMLDivElement | null>(null)

  const tb = topbar ?? FALLBACK_TOPBAR
  const hd = header ?? FALLBACK_HEADER
  const mobileLimit = hd.mobile_menu_categories?.limit ?? null
  const mobileCategories =
    mobileLimit == null ? categories : categories.slice(0, mobileLimit)

  /* Sticky header — same behavior as the template's script.js: the
     .header__sticky bar gets "sticky" once scrollY passes the header's
     top offset.

     The trigger point is measured from a zero-height spacer that stays in
     normal flow, NOT from the header itself. When the header becomes
     position: fixed it leaves the flow, so its own getBoundingClientRect
     collapses to the viewport top; measuring the threshold off the live
     header therefore made the condition flip stuck/unstuck on every scroll
     event — a feedback loop that shook the page. The spacer's offset is
     stable in both states. Scroll writes are batched through rAF, and the
     spacer reserves the header's height so content never jumps when the
     header detaches. */
  useEffect(() => {
    const host = headerRef.current
    const spacer = spacerRef.current
    if (!host || !spacer) {
      return
    }

    let ticking = false
    let triggerTop = 0
    let headerHeight = 0

    const measure = () => {
      triggerTop = spacer.getBoundingClientRect().top + window.scrollY
      if (!host.classList.contains("sticky")) {
        headerHeight = host.offsetHeight
      }
    }

    const update = () => {
      ticking = false
      const shouldStick = window.scrollY > triggerTop
      spacer.style.height = shouldStick ? `${headerHeight}px` : "0px"
      setStuck(shouldStick)
    }

    const onScroll = () => {
      if (ticking) {
        return
      }
      ticking = true
      window.requestAnimationFrame(update)
    }

    const onResize = () => {
      measure()
      update()
    }

    measure()
    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  /* Body classes drive the template's dark overlay + scroll lock
     (body::before via .mobile_menu_open / .predictive__search--box_active,
     exactly what script.js toggled). */
  useEffect(() => {
    document.body.classList.toggle("mobile_menu_open", menuOpen)
    return () => document.body.classList.remove("mobile_menu_open")
  }, [menuOpen])

  useEffect(() => {
    document.body.classList.toggle("predictive__search--box_active", searchOpen)
    return () =>
      document.body.classList.remove("predictive__search--box_active")
  }, [searchOpen])

  /* Escape closes every overlay; clicking outside the offcanvas panel /
     search box closes them too (script.js behavior). */
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

  useEffect(() => {
    if (!menuOpen && !searchOpen) {
      return
    }
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (
        menuOpen &&
        !target.closest(".offcanvas-header") &&
        !target.closest(".offcanvas__header--menu__open--btn")
      ) {
        setMenuOpen(false)
      }
      if (
        searchOpen &&
        !target.closest(".predictive__search--box") &&
        !target.closest(".search__open--btn")
      ) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("click", onClick)
    return () => document.removeEventListener("click", onClick)
  }, [menuOpen, searchOpen])

  return (
    <div className="rokon-theme">
      <header className="header__section">
        {/* Header topbar */}
        {tb.enabled && (
          <div className="header__topbar bg__primary color-primary-2">
            <div className="container">
              <div className="header__topbar--inner d-flex align-items-center justify-content-between">
                <ul className="header__contact--info d-flex align-items-center">
                  <li className="header__contact--info__list text-white">
                    {tb.message}
                  </li>
                  {tb.links.map((link, i) => (
                    <TopbarLink key={i} link={link} />
                  ))}
                </ul>
                <div className="language__currency d-none d-lg-block">
                  <ul className="d-flex align-items-center">
                    <TopbarLanguage locale={locale} />
                    <li className="language__currency--list">
                      {/* Static currency label — no fake switcher. */}
                      <span className="account__currency--link text-white">
                        <span>{tb.currency_label}</span>
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Spacer that reserves the main header's height while it is fixed,
            keeping the trigger point stable and the content from jumping. */}
        <div ref={spacerRef} aria-hidden="true" />

        {/* Main header */}
        <div
          className={`main__header position__relative header__sticky${
            stuck ? " sticky" : ""
          }`}
          ref={headerRef}
        >
          <div className="container">
            <div className="main__header--inner d-flex justify-content-between align-items-center">
              <div className="offcanvas__header--menu__open">
                <a
                  className="offcanvas__header--menu__open--btn"
                  href="#"
                  role="button"
                  aria-expanded={menuOpen}
                  onClick={(e) => {
                    e.preventDefault()
                    setMenuOpen(true)
                  }}
                >
                  <HamburgerIcon />
                  <span className="visually-hidden">Offcanvas Menu Open</span>
                </a>
              </div>
              <div className="main__logo">
                <h1 className="main__logo--title">
                  <LocalizedClientLink className="main__logo--link" href="/">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="main__logo--img"
                      src={hd.logo} style={chromeLogoStyle(hd as any)}
                      alt={hd.logo_alt}
                    />
                  </LocalizedClientLink>
                </h1>
              </div>
              <div className="header__menu d-none d-lg-block">
                <nav className="header__menu--navigation">
                  <DesktopNav menu={hd.menu} categories={categories} />
                </nav>
              </div>
              <div className="header__account">
                <ul className="d-flex">
                  {hd.search.enabled && (
                    <li className="header__account--items header__account--search__items">
                      <a
                        className="header__account--btn search__open--btn"
                        href="#"
                        role="button"
                        aria-expanded={searchOpen}
                        onClick={(e) => {
                          e.preventDefault()
                          setSearchOpen(true)
                        }}
                      >
                        <SearchIcon className="header__search--button__svg" />
                        <span className="visually-hidden">Search</span>
                      </a>
                    </li>
                  )}
                  <li className="header__account--items">
                    <LocalizedClientLink
                      className="header__account--btn"
                      href={hd.icons.account}
                    >
                      <UserIcon />
                      <span className="visually-hidden">My Account</span>
                    </LocalizedClientLink>
                  </li>
                  <li className="header__account--items">
                    <LocalizedClientLink
                      className="header__account--btn"
                      href={hd.icons.cart}
                    >
                      <BagIcon />
                      <span className="visually-hidden">Cart</span>
                      {cartCount > 0 && (
                        <span className="items__count">{cartCount}</span>
                      )}
                    </LocalizedClientLink>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Offcanvas header menu (React state instead of script.js) */}
        <OffcanvasMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          logo={hd.logo}
          logoAlt={hd.logo_alt}
          menu={hd.menu}
          categories={categories}
          mobileCategories={mobileCategories}
          accountHref={hd.icons.account}
          locale={locale}
        />

        {/* Offcanvas sticky toolbar (mobile bottom bar) */}
        <div className="offcanvas__stikcy--toolbar" tabIndex={-1}>
          <ul className="d-flex justify-content-between">
            <li className="offcanvas__stikcy--toolbar__list">
              <LocalizedClientLink
                className="offcanvas__stikcy--toolbar__btn"
                href="/"
              >
                <span className="offcanvas__stikcy--toolbar__icon">
                  <HomeIcon />
                </span>
                <span className="offcanvas__stikcy--toolbar__label">Home</span>
              </LocalizedClientLink>
            </li>
            <li className="offcanvas__stikcy--toolbar__list">
              <LocalizedClientLink
                className="offcanvas__stikcy--toolbar__btn"
                href="/store"
              >
                <span className="offcanvas__stikcy--toolbar__icon">
                  <GridIcon />
                </span>
                <span className="offcanvas__stikcy--toolbar__label">Shop</span>
              </LocalizedClientLink>
            </li>
            {hd.search.enabled && (
              <li className="offcanvas__stikcy--toolbar__list">
                <a
                  className="offcanvas__stikcy--toolbar__btn search__open--btn"
                  href="#"
                  role="button"
                  onClick={(e) => {
                    e.preventDefault()
                    setSearchOpen(true)
                  }}
                >
                  <span className="offcanvas__stikcy--toolbar__icon">
                    <SearchIcon width="22.51" height="20.443" />
                  </span>
                  <span className="offcanvas__stikcy--toolbar__label">
                    Search
                  </span>
                </a>
              </li>
            )}
            <li className="offcanvas__stikcy--toolbar__list">
              <LocalizedClientLink
                className="offcanvas__stikcy--toolbar__btn"
                href={hd.icons.cart}
              >
                <span className="offcanvas__stikcy--toolbar__icon">
                  <CartIcon />
                </span>
                <span className="offcanvas__stikcy--toolbar__label">Cart</span>
                {cartCount > 0 && (
                  <span className="items__count">{cartCount}</span>
                )}
              </LocalizedClientLink>
            </li>
            <li className="offcanvas__stikcy--toolbar__list">
              <LocalizedClientLink
                className="offcanvas__stikcy--toolbar__btn"
                href={hd.icons.wishlist}
              >
                <span className="offcanvas__stikcy--toolbar__icon">
                  <HeartIcon />
                </span>
                <span className="offcanvas__stikcy--toolbar__label">
                  Wishlist
                </span>
              </LocalizedClientLink>
            </li>
          </ul>
        </div>

        {/* Predictive search box */}
        {hd.search.enabled && (
          <PredictiveSearch
            open={searchOpen}
            action={hd.search.action}
            placeholder={hd.search.placeholder}
            onClose={() => setSearchOpen(false)}
          />
        )}
      </header>
    </div>
  )
}

export default RokonHeader
