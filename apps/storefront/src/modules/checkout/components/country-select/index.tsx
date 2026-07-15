import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"

import NativeSelect, {
  NativeSelectProps,
} from "@modules/common/components/native-select"
import { HttpTypes } from "@medusajs/types"

// Full ISO 3166-1 alpha-2 list. In this pooled multi-tenant setup a country can
// belong to only one region globally (region_country.iso_2 is unique), so stores
// keep a single region with no countries assigned. The checkout address country
// therefore comes from this static list rather than region.countries; shipping
// options are still resolved from the location's service zones by country.
const ALL_COUNTRY_CODES =
  "af ax al dz as ad ao ai aq ag ar am aw au at az bs bh bd bb by be bz bj bm bt bo bq ba bw bv br io bn bg bf bi cv kh cm ca ky cf td cl cn cx cc co km cg cd ck cr ci hr cu cw cy cz dk dj dm do ec eg sv gq er ee sz et fk fo fj fi fr gf pf tf ga gm ge de gh gi gr gl gd gp gu gt gg gn gw gy ht hm va hn hk hu is in id ir iq ie im il it jm jp je jo kz ke ki kp kr kw kg la lv lb ls lr ly li lt lu mo mg mw my mv ml mt mh mq mr mu yt mx fm md mc mn me ms ma mz mm na nr np nl nc nz ni ne ng nu nf mk mp no om pk pw ps pa pg py pe ph pn pl pt pr qa re ro ru rw bl sh kn lc mf pm vc ws sm st sa sn rs sc sl sg sx sk si sb so za gs ss es lk sd sr sj se ch sy tw tj tz th tl tg tk to tt tn tr tm tc tv ug ua ae gb us um uy uz vu ve vn vg vi wf eh ye zm zw".split(
    " "
  )

function countryLabel(code: string): string {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" })
    return dn.of(code.toUpperCase()) || code.toUpperCase()
  } catch {
    return code.toUpperCase()
  }
}

const STATIC_COUNTRY_OPTIONS = ALL_COUNTRY_CODES.map((c) => ({
  value: c,
  label: countryLabel(c),
})).sort((a, b) => a.label.localeCompare(b.label))

const CountrySelect = forwardRef<
  HTMLSelectElement,
  NativeSelectProps & {
    region?: HttpTypes.StoreRegion
  }
>(({ placeholder = "Country", region, defaultValue, ...props }, ref) => {
  const innerRef = useRef<HTMLSelectElement>(null)

  // The countries this store can actually DELIVER to. Pooled tenants share a
  // region that lists every country on earth, so without this the form offered
  // countries the merchant has no shipping option for — the shopper picked one,
  // reached Delivery, saw no shipping method, and "Continue to payment" never
  // enabled. Do not offer what cannot be shipped.
  const [shippable, setShippable] = useState<string[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch("/api/shipping-countries", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d?.countries)) {
          setShippable(d.countries)
        }
      })
      .catch(() => {
        // Unknown coverage -> fall back to the full list rather than locking the
        // shopper out of checkout entirely.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useImperativeHandle<HTMLSelectElement | null, HTMLSelectElement | null>(
    ref,
    () => innerRef.current
  )

  const countryOptions = useMemo(() => {
    const fromRegion = region?.countries?.map((country) => ({
      value: country.iso_2 as string,
      label: (country.display_name || country.iso_2) as string,
    }))
    // Fall back to the full static list when the region has no countries
    // assigned (the norm in this multi-tenant setup).
    const base =
      fromRegion && fromRegion.length > 0 ? fromRegion : STATIC_COUNTRY_OPTIONS

    // Narrow to what the store can actually ship. An EMPTY coverage list means
    // delivery is not configured at all — in that case show everything rather
    // than an empty dropdown, and let the merchant's checklist do the shouting.
    if (shippable && shippable.length > 0) {
      const allowed = new Set(shippable)
      const narrowed = base.filter((o) =>
        allowed.has(String(o.value).toLowerCase())
      )
      if (narrowed.length > 0) {
        return narrowed
      }
    }
    return base
  }, [region, shippable])

  return (
    <NativeSelect
      ref={innerRef}
      placeholder={placeholder}
      defaultValue={defaultValue}
      {...props}
    >
      {countryOptions?.map(({ value, label }, index) => (
        <option key={index} value={value}>
          {label}
        </option>
      ))}
    </NativeSelect>
  )
})

CountrySelect.displayName = "CountrySelect"

export default CountrySelect
