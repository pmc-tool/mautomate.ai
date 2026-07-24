import { NextRequest, NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { sdk } from "@lib/config"
import {
  addCustomerAddress,
  deleteCustomerAddress,
  login,
  requestPasswordReset,
  retrieveCustomer,
  signup,
  transferCart,
  updateCustomer,
  updateCustomerAddress,
  updateCustomerPassword,
} from "@lib/data/customer"
import {
  getCacheTag,
  removeAuthToken,
  removeCartId,
} from "@lib/data/cookies"

/* ------------------------------------------------------------------ */
/* POST /api/theme-account — customer auth + account mutations for     */
/* UPLOADED Liquid themes.                                             */
/*                                                                     */
/* Same design as /api/theme-cart: thin wrappers over the EXACT server */
/* actions the React storefront uses (lib/data/customer.ts), so the    */
/* tenant publishable key, the httpOnly _medusa_jwt session cookie and */
/* every validation rule (password policy, email pattern, enumeration  */
/* safety) are identical on both rendering paths. The theme's JS only  */
/* ever talks same-origin; credentials never reach theme code.         */
/*                                                                     */
/* Actions (JSON body):                                                */
/*   login           { email, password }                               */
/*   register        { email, password, confirm_password, first_name,  */
/*                     last_name, phone?, terms_accepted }             */
/*   logout          {}                                                */
/*   recover         { email }                                         */
/*   reset           { token, password, confirm }                      */
/*   profile         { first_name?, last_name?, phone? }               */
/*   address_add     { first_name, last_name, address_1, city,         */
/*                     postal_code, country_code, … , default_shipping?,*/
/*                     default_billing? }                              */
/*   address_update  { address_id, …same fields }                      */
/*   address_delete  { address_id }                                    */
/* ------------------------------------------------------------------ */

const ADDRESS_FIELDS = [
  "first_name",
  "last_name",
  "company",
  "address_1",
  "address_2",
  "city",
  "postal_code",
  "province",
  "country_code",
  "phone",
] as const

function toFormData(body: Record<string, unknown>, keys: readonly string[]) {
  const fd = new FormData()
  for (const k of keys) {
    const v = body[k]
    if (v != null && v !== "") fd.set(k, String(v))
  }
  return fd
}

function authStateResponse(state: any) {
  if (!state) return NextResponse.json({ ok: true, state: "success" })
  if (state.state === "error") {
    return NextResponse.json(
      { ok: false, error: state.error || "Something went wrong." },
      { status: 400 }
    )
  }
  // "success" | "verification_required" | "sent" — all non-error outcomes.
  return NextResponse.json({ ok: true, ...state })
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || "")

    if (action === "login") {
      const fd = toFormData(body, ["email", "password"])
      const state = await login(null, fd)
      if (state?.state === "success") {
        // Bring the guest cart along, exactly like the React login flow.
        await transferCart().catch(() => {})
      }
      return authStateResponse(state)
    }

    if (action === "register") {
      const fd = toFormData(body, [
        "email",
        "password",
        "confirm_password",
        "first_name",
        "last_name",
        "phone",
      ])
      // signup reads terms_accepted as a checkbox presence — only set truthy.
      if (body.terms_accepted) fd.set("terms_accepted", "on")
      const state = await signup(null, fd)
      if (state?.state === "success") {
        await transferCart().catch(() => {})
      }
      return authStateResponse(state)
    }

    if (action === "logout") {
      // signout() ends with a redirect(), which a JSON endpoint can't use —
      // same teardown, minus the redirect.
      try {
        await sdk.auth.logout()
      } catch {
        // The token may already be invalid; clearing cookies is what matters.
      }
      await removeAuthToken()
      await removeCartId()
      revalidateTag(await getCacheTag("customers"))
      revalidateTag(await getCacheTag("carts"))
      return NextResponse.json({ ok: true, state: "success" })
    }

    if (action === "recover") {
      const state = await requestPasswordReset(null, toFormData(body, ["email"]))
      return authStateResponse(state)
    }

    if (action === "reset") {
      const state = await updateCustomerPassword(
        null,
        toFormData(body, ["token", "password", "confirm"])
      )
      return authStateResponse(state)
    }

    /* ---- everything below requires a signed-in customer ---- */
    const customer = await retrieveCustomer()
    if (!customer) {
      return NextResponse.json(
        { ok: false, error: "Please sign in first." },
        { status: 401 }
      )
    }

    if (action === "profile") {
      const update: Record<string, string> = {}
      for (const k of ["first_name", "last_name", "phone"]) {
        if (typeof body[k] === "string") update[k] = String(body[k]).trim()
      }
      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
      }
      await updateCustomer(update)
      return NextResponse.json({ ok: true, state: "success" })
    }

    if (action === "address_add") {
      const result = await addCustomerAddress(
        {
          isDefaultShipping: !!body.default_shipping,
          isDefaultBilling: !!body.default_billing,
        },
        toFormData(body, ADDRESS_FIELDS)
      )
      if (!result.success) {
        return NextResponse.json(
          { ok: false, error: result.error || "Could not save the address." },
          { status: 400 }
        )
      }
      return NextResponse.json({ ok: true, state: "success" })
    }

    if (action === "address_update") {
      const addressId = String(body.address_id || "")
      if (!addressId) {
        return NextResponse.json({ error: "Missing address" }, { status: 400 })
      }
      const result = await updateCustomerAddress(
        { addressId },
        toFormData(body, ADDRESS_FIELDS)
      )
      if (!result.success) {
        return NextResponse.json(
          { ok: false, error: result.error || "Could not save the address." },
          { status: 400 }
        )
      }
      return NextResponse.json({ ok: true, state: "success" })
    }

    if (action === "address_delete") {
      const addressId = String(body.address_id || "")
      if (!addressId) {
        return NextResponse.json({ error: "Missing address" }, { status: 400 })
      }
      await deleteCustomerAddress(addressId)
      return NextResponse.json({ ok: true, state: "success" })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Something went wrong" },
      { status: 500 }
    )
  }
}
