import { Metadata } from "next"

import { parseOptionValueIds } from "@lib/util/product-option-filters"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"
import { getActiveTheme } from "@themes/registry"

export const metadata: Metadata = {
  title: "Store",
  description: "Explore all of our products.",
}

type StorePageSearchParams = Record<string, string | string[] | undefined> & {
  sortBy?: SortOptions
  page?: string
  optionValueIds?: string | string[]
}

type Params = {
  searchParams: Promise<StorePageSearchParams>
  params: Promise<{
    countryCode: string
  }>
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page } = searchParams
  const optionValueIds = parseOptionValueIds(searchParams)
  const query =
    typeof searchParams.q === "string" ? searchParams.q : undefined

  // The active theme MAY provide a bespoke store template; otherwise the
  // default (Learts-base) template renders.
  const activeTheme = await getActiveTheme()
  const Store = activeTheme.templates?.store ?? StoreTemplate

  return (
    <Store
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
      optionValueIds={optionValueIds}
      query={query}
    />
  )
}
