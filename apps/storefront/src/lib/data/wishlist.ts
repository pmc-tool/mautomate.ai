"use server"

import { retrieveCustomer, updateCustomer } from "./customer"

// Reads the wishlist product ids stored on the customer's metadata,
// defensively filtering to strings (metadata is untyped JSON).
const readStoredWishlist = (metadata?: Record<string, unknown> | null) => {
  const stored = metadata?.wishlist
  return Array.isArray(stored)
    ? stored.filter((id): id is string => typeof id === "string")
    : []
}

/**
 * Merges the guest (localStorage) wishlist with the one stored on the
 * logged-in customer's metadata and persists the union when it changed.
 *
 * Returns the merged ids for a logged-in customer, or `null` for guests so
 * the client keeps relying on localStorage only.
 */
export async function syncWishlist(
  localIds: string[]
): Promise<string[] | null> {
  const customer = await retrieveCustomer().catch(() => null)

  if (!customer) {
    return null
  }

  const stored = readStoredWishlist(customer.metadata)
  const local = (localIds ?? []).filter(
    (id): id is string => typeof id === "string"
  )
  const merged = Array.from(new Set([...stored, ...local]))

  const changed =
    merged.length !== stored.length ||
    merged.some((id, i) => id !== stored[i])

  if (changed) {
    await updateCustomer({
      metadata: { ...customer.metadata, wishlist: merged },
    }).catch(() => null)
  }

  return merged
}

/**
 * Persists the given wishlist ids on the logged-in customer's metadata.
 * Silent no-op for guests. Never throws — the client treats this as
 * fire-and-forget and localStorage remains the source of truth on failure.
 */
export async function persistWishlist(ids: string[]): Promise<void> {
  try {
    const customer = await retrieveCustomer().catch(() => null)

    if (!customer) {
      return
    }

    await updateCustomer({
      metadata: { ...customer.metadata, wishlist: ids },
    })
  } catch {
    // Ignore: wishlist persistence must never break the UI.
  }
}
