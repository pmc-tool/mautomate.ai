import { redirect } from "next/navigation"

export default function LegacyDiscountCreatePage() {
  redirect("/dashboard/promotions/create")
}
