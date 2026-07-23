"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { FetchError } from "@medusajs/js-sdk"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import {
  getAuthHeaders,
  getCacheOptions,
  getCacheTag,
  getCartId,
  getPendingCustomer,
  removeAuthToken,
  removeCartId,
  removePendingCustomer,
  setAuthToken,
  setPendingCustomer,
} from "./cookies"

export type CustomerAuthState =
  | { state: "error"; error: string }
  | { state: "verification_required"; email: string }
  | { state: "success" }
  | null

// Requests a verification email for the authenticated customer through the
// backend's custom email-verification routes (Medusa core has none).
async function requestVerificationEmail(token: string) {
  await sdk.client.fetch(`/store/auth/email-verification/request`, {
    method: "POST",
    body: {},
    headers: { authorization: `Bearer ${token}` },
  })
}

export const retrieveCustomer =
  async (): Promise<HttpTypes.StoreCustomer | null> => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    const headers = {
      ...authHeaders,
    }

    const next = {
      ...(await getCacheOptions("customers")),
    }

    return await sdk.client
      .fetch<{ customer: HttpTypes.StoreCustomer }>(`/store/customers/me`, {
        method: "GET",
        query: {
          fields: "*orders",
        },
        headers,
        next,
        cache: "force-cache",
      })
      .then(({ customer }) => customer)
      .catch(() => null)
  }

export const updateCustomer = async (body: HttpTypes.StoreUpdateCustomer) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const updateRes = await sdk.store.customer
    .update(body, {}, headers)
    .then(({ customer }) => customer)
    .catch(medusaError)

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return updateRes
}

// Stricter than the HTML5 email rule (which accepts "user@mail" with no TLD):
// require a dot-separated domain so obviously undeliverable addresses are
// rejected before any side effect runs.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const updateCustomerEmail = async (
  _currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> => {
  const email = ((formData.get("email") as string) || "").trim()
  const password = (formData.get("current_password") as string) || ""

  if (!EMAIL_PATTERN.test(email)) {
    return { success: false, error: "Enter a valid email address." }
  }
  if (!password) {
    return {
      success: false,
      error: "Enter your current password to confirm the change.",
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  try {
    await sdk.client.fetch(`/store/customers/me/email`, {
      method: "POST",
      body: { email, password },
      headers,
    })
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || "Could not update your email. Please try again.",
    }
  }

  const cacheTag = await getCacheTag("customers")
  revalidateTag(cacheTag)

  return { success: true, error: null }
}

// Returns a human-readable problem with the password, or null when it meets
// the policy: 8+ chars with upper, lower, digit and special character.
function passwordPolicyProblem(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters."
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter."
  }
  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter."
  }
  if (!/\d/.test(password)) {
    return "Password must include a number."
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include a special character."
  }
  return null
}

export async function signup(
  _currentState: unknown,
  formData: FormData
): Promise<CustomerAuthState> {
  const password = (formData.get("password") as string) || ""
  const confirmPassword = (formData.get("confirm_password") as string) || ""
  const termsAccepted = !!formData.get("terms_accepted")
  const customerForm = {
    email: ((formData.get("email") as string) || "").trim(),
    first_name: ((formData.get("first_name") as string) || "").trim(),
    last_name: ((formData.get("last_name") as string) || "").trim(),
    phone: ((formData.get("phone") as string) || "").trim(),
  }

  // Validate everything BEFORE any side effect, so a bad submit surfaces a
  // visible error instead of half-registering and silently resetting the form.
  if (!customerForm.first_name || !customerForm.last_name) {
    return { state: "error", error: "First and last name are required." }
  }
  if (!EMAIL_PATTERN.test(customerForm.email)) {
    return {
      state: "error",
      error: "Enter a valid email address, like name@example.com.",
    }
  }
  const passwordProblem = passwordPolicyProblem(password)
  if (passwordProblem) {
    return { state: "error", error: passwordProblem }
  }
  if (password !== confirmPassword) {
    return { state: "error", error: "The two passwords do not match." }
  }
  if (!termsAccepted) {
    return {
      state: "error",
      error: "Please agree to the Terms of Use and Privacy Policy to continue.",
    }
  }

  try {
    try {
      await sdk.auth.register("customer", "emailpass", {
        email: customerForm.email,
        password,
      })
    } catch (error) {
      const fetchError = error as FetchError
      // An existing identity (for example, an admin user with the same email) is
      // expected and handled: the customer can still log in to link a customer
      // record. Any other error is surfaced.
      if (
        fetchError.statusText !== "Unauthorized" ||
        fetchError.message !== "Identity with email already exists"
      ) {
        return { state: "error", error: String(error) }
      }
    }

    // Persist the extra signup fields. The customer record is created during
    // login, which is deferred until after email verification when the backend
    // requires it.
    await setPendingCustomer(customerForm)

    // Continue by logging in. The login response tells us whether the backend
    // requires email verification — we don't need a storefront-side flag.
    return await completeLogin(customerForm.email, password)
  } catch (error) {
    // No failure may escape as a rejection: an escaped throw leaves
    // useActionState at null, which renders NO error and looks like the form
    // "just reset".
    return { state: "error", error: String(error) }
  }
}

export async function login(
  _currentState: unknown,
  formData: FormData
): Promise<CustomerAuthState> {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  return completeLogin(email, password)
}

// Logs the customer in and reconciles the customer record. The behavior is
// driven entirely by the backend's login response, so it works whether or not
// email verification is enabled.
async function completeLogin(
  email: string,
  password: string
): Promise<CustomerAuthState> {
  let result: Awaited<ReturnType<typeof sdk.auth.login>>

  try {
    result = await sdk.auth.login("customer", "emailpass", { email, password })
  } catch (error) {
    return { state: "error", error: String(error) }
  }

  // A `location` is returned by third-party auth providers, which this flow
  // doesn't support.
  if (typeof result === "object" && "location" in result) {
    return {
      state: "error",
      error: "This login method isn't supported by the storefront.",
    }
  }

  if (typeof result !== "string") {
    return {
      state: "error",
      error: "Authentication requires additional steps that aren't supported.",
    }
  }

  let token = result

  // The token may not be tied to a customer record yet — right after
  // registration, or after verifying a brand-new account. Ask the backend:
  // `/store/customers/me` rejects tokens without a registered actor, so a
  // failed retrieve means we still need to create the customer, then log in
  // again to obtain a customer-bound token.
  const customerExists = await sdk.store.customer
    .retrieve({}, { authorization: `Bearer ${token}` })
    .then(() => true)
    .catch(() => false)

  if (!customerExists) {
    const pending = await getPendingCustomer()

    try {
      await sdk.store.customer.create(
        {
          email,
          first_name: pending?.first_name,
          last_name: pending?.last_name,
          phone: pending?.phone,
        },
        {},
        { authorization: `Bearer ${token}` }
      )

      token = (await sdk.auth.login("customer", "emailpass", {
        email,
        password,
      })) as string
    } catch (error) {
      return { state: "error", error: String(error) }
    }

    await removePendingCustomer()
  }

  // Email verification (env-gated on the backend): when this deployment
  // requires it and the customer hasn't verified yet, send the email and stop
  // short of creating the session. Fail-open on a broken check — verification
  // must never be able to lock every shopper out.
  try {
    const check = await sdk.client.fetch<{
      required: boolean
      verified: boolean
    }>(`/store/auth/email-verification/check`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (check?.required && !check?.verified) {
      try {
        await requestVerificationEmail(token)
      } catch {
        // Ignore: the customer can resend by signing in again.
      }
      return { state: "verification_required", email }
    }
  } catch {
    // Fail-open.
  }

  await setAuthToken(token)

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  try {
    await transferCart()
  } catch (error) {
    return { state: "error", error: String(error) }
  }

  return { state: "success" }
}

// Confirms a customer's email using the token from the verification link.
//
// The confirm route doesn't require authentication, so this works even when the
// customer opens the link on a different device than the one they signed up on.
export async function confirmEmailVerification(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await sdk.client.fetch(`/store/auth/email-verification/confirm`, {
      method: "POST",
      body: { token },
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export async function signout(countryCode: string) {
  await sdk.auth.logout()

  await removeAuthToken()

  const customerCacheTag = await getCacheTag("customers")
  revalidateTag(customerCacheTag)

  await removeCartId()

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)

  redirect(`/${countryCode}/account`)
}

export async function transferCart() {
  const cartId = await getCartId()

  if (!cartId) {
    return
  }

  const headers = await getAuthHeaders()

  await sdk.store.cart.transferCart(cartId, {}, headers)

  const cartCacheTag = await getCacheTag("carts")
  revalidateTag(cartCacheTag)
}

export const addCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> => {
  const isDefaultBilling = (currentState.isDefaultBilling as boolean) || false
  const isDefaultShipping = (currentState.isDefaultShipping as boolean) || false

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
    phone: formData.get("phone") as string,
    is_default_billing: isDefaultBilling,
    is_default_shipping: isDefaultShipping,
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .createAddress(address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const deleteCustomerAddress = async (
  addressId: string
): Promise<void> => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  await sdk.store.customer
    .deleteAddress(addressId, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

export const updateCustomerAddress = async (
  currentState: Record<string, unknown>,
  formData: FormData
): Promise<{ success: boolean; error: string | null }> => {
  const addressId =
    (currentState.addressId as string) || (formData.get("addressId") as string)

  if (!addressId) {
    return { success: false, error: "Address ID is required" }
  }

  const address = {
    first_name: formData.get("first_name") as string,
    last_name: formData.get("last_name") as string,
    company: formData.get("company") as string,
    address_1: formData.get("address_1") as string,
    address_2: formData.get("address_2") as string,
    city: formData.get("city") as string,
    postal_code: formData.get("postal_code") as string,
    province: formData.get("province") as string,
    country_code: formData.get("country_code") as string,
  } as HttpTypes.StoreUpdateCustomerAddress

  const phone = formData.get("phone") as string

  if (phone) {
    address.phone = phone
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  return sdk.store.customer
    .updateAddress(addressId, address, {}, headers)
    .then(async () => {
      const customerCacheTag = await getCacheTag("customers")
      revalidateTag(customerCacheTag)
      return { success: true, error: null }
    })
    .catch((err) => {
      return { success: false, error: err.toString() }
    })
}

/* ------------------------------------------------------------------ *
 * Password recovery (customer persona)
 *
 * Both calls go through sdk.client.fetch, which injects the tenant publishable
 * key (x-publishable-api-key) exactly like every other storefront store call —
 * required so the backend resolves WHICH store the customer belongs to.
 * ------------------------------------------------------------------ */

export type PasswordResetState =
  | { state: "idle" }
  | { state: "sent"; email: string }
  | { state: "success" }
  | { state: "error"; error: string }
  | null

// Request a reset email. The backend always returns 201 and never reveals
// whether an account exists (no enumeration), so we always land on the generic
// "sent" confirmation — even if the underlying call errors, we do not leak.
export async function requestPasswordReset(
  _prev: PasswordResetState,
  formData: FormData
): Promise<PasswordResetState> {
  const email = ((formData.get("email") as string) || "").trim()
  if (!email) {
    return { state: "error", error: "Please enter your email address." }
  }
  try {
    await sdk.auth.resetPassword("customer", "emailpass", { identifier: email })
  } catch {
    // Swallow: never reveal existence, and a 201 body can still parse-fail.
  }
  return { state: "sent", email }
}

// Confirm a new password with the single-use token from the reset link. The
// token is a Bearer credential, NOT a session; a 4xx means expired/used/bad.
export async function updateCustomerPassword(
  _prev: PasswordResetState,
  formData: FormData
): Promise<PasswordResetState> {
  const token = ((formData.get("token") as string) || "").trim()
  const password = (formData.get("password") as string) || ""
  const confirm = (formData.get("confirm") as string) || ""
  if (!token) {
    return {
      state: "error",
      error: "This reset link is missing its token. Request a new link.",
    }
  }
  if (password.length < 8) {
    return {
      state: "error",
      error: "Your new password must be at least 8 characters.",
    }
  }
  if (password !== confirm) {
    return { state: "error", error: "The two passwords do not match." }
  }
  try {
    await sdk.auth.updateProvider(
      "customer",
      "emailpass",
      { password },
      token
    )
  } catch {
    return {
      state: "error",
      error: "This reset link is invalid or has expired. Request a new one.",
    }
  }
  return { state: "success" }
}
