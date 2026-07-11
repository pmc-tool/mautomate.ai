import { Metadata } from "next"

import { getRegion } from "@lib/data/regions"
import WishlistTemplate from "@modules/wishlist/templates"

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Products you have saved for later.",
}

type Params = {
  params: Promise<{ countryCode: string }>
}

export default async function WishlistPage(props: Params) {
  const { countryCode } = await props.params

  // Price calculation on /store/products requires a region_id, which the
  // client can't derive from the country code alone — resolve it here.
  const region = await getRegion(countryCode)

  return <WishlistTemplate regionId={region?.id} />
}
