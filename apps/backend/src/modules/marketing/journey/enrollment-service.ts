import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
import { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from "../index"

/**
 * Journey enrollment service — the bridge from a commerce event to a live
 * journey enrollment row. Trigger subscribers resolve a contact reference
 * (email / customer_id / name) from an event payload and call
 * `enrollForTrigger`, which finds the active journeys wired to that event,
 * resolves-or-creates a marketing_contact, and drops a fresh enrollment row for
 * each matching journey. The runner then sweeps those rows.
 *
 * MULTI-TENANT: every function takes `tenantId` and scopes all reads/writes.
 *
 * NEVER THROWS: enrollment is a side effect of a commerce operation. A hiccup
 * here must not fail order placement / customer signup / cart updates, so every
 * function swallows its own errors (logs via the container logger) and returns a
 * benign result.
 */

const currentTenantId = (): string =>
  getCurrentTenantId() ?? resolveTenantId("MARKETING_DEFAULT_TENANT")

type ContactRef = {
  email?: string | null
  customerId?: string | null
  name?: string | null
}

const getLogger = (container: MedusaContainer): any => {
  try {
    return container.resolve("logger")
  } catch {
    return undefined
  }
}

/**
 * Best-effort resolve a marketing_contact for the given reference, creating one
 * if none exists. Matches first by email, then by customer_id. Returns the
 * contact row, or null if it could neither find nor create one.
 */
export const findOrCreateContact = async (
  container: MedusaContainer,
  tenantId: string,
  ref: ContactRef
): Promise<any | null> => {
  const email = ref.email?.trim() || undefined
  const customerId = ref.customerId?.trim() || undefined

  if (!email && !customerId) {
    return null
  }

  try {
    const svc: any = container.resolve(MARKETING_MODULE)

    if (email) {
      const byEmail = await svc.listMarketingContacts({
        tenant_id: tenantId,
        email,
      })
      if (byEmail?.length) {
        return byEmail[0]
      }
    }

    if (customerId) {
      const byCustomer = await svc.listMarketingContacts({
        tenant_id: tenantId,
        customer_id: customerId,
      })
      if (byCustomer?.length) {
        return byCustomer[0]
      }
    }

    const created = await svc.createMarketingContacts({
      tenant_id: tenantId,
      email: email ?? null,
      customer_id: customerId ?? null,
      display_name: ref.name?.trim() || null,
    } as any)

    return Array.isArray(created) ? created[0] : created
  } catch (e) {
    getLogger(container)?.error?.(
      `[marketing] findOrCreateContact error (swallowed): ${
        (e as any)?.message ?? e
      }`
    )
    return null
  }
}

type EnrollContactInput = {
  tenantId: string
  journeyId: string
  contactId?: string | null
  email?: string | null
  customerId?: string | null
  context?: Record<string, unknown>
}

type EnrollContactResult = {
  enrolled: boolean
  enrollmentId?: string
  reason?: string
}

/**
 * Enroll one contact into one journey, honoring the journey's status and
 * re-enrollment policy. Skips unless the journey is "active"; skips (reason
 * "already_enrolled") when re-enrollment is off and an enrollment already exists
 * for (journey_id, contact_id).
 */
export const enrollContact = async (
  container: MedusaContainer,
  input: EnrollContactInput
): Promise<EnrollContactResult> => {
  const { tenantId, journeyId, contactId, email, customerId, context } = input

  try {
    const svc: any = container.resolve(MARKETING_MODULE)

    const journeys = await svc.listMarketingJourneys({
      tenant_id: tenantId,
      id: journeyId,
    })
    const journey = journeys?.[0]

    if (!journey) {
      return { enrolled: false, reason: "journey_not_found" }
    }

    if (journey.status !== "active") {
      return { enrolled: false, reason: "journey_not_active" }
    }

    if (!journey.allow_reenroll && contactId) {
      const existing = await svc.listMarketingJourneyEnrollments({
        tenant_id: tenantId,
        journey_id: journeyId,
        contact_id: contactId,
      })
      if (existing?.length) {
        return { enrolled: false, reason: "already_enrolled" }
      }
    }

    const now = new Date()
    const created = await svc.createMarketingJourneyEnrollments({
      tenant_id: tenantId,
      journey_id: journeyId,
      contact_id: contactId ?? null,
      email: email ?? null,
      customer_id: customerId ?? null,
      step_index: 0,
      status: "active",
      next_run_at: now,
      entered_at: now,
      context: context ?? null,
    } as any)

    const row = Array.isArray(created) ? created[0] : created
    return { enrolled: true, enrollmentId: row?.id }
  } catch (e) {
    getLogger(container)?.error?.(
      `[marketing] enrollContact error (swallowed) for journey ${journeyId}: ${
        (e as any)?.message ?? e
      }`
    )
    return { enrolled: false, reason: "error" }
  }
}

type EnrollForTriggerInput = {
  tenantId?: string
  event: string
  contactRef: ContactRef
  context?: Record<string, unknown>
}

/**
 * Fan a single commerce trigger out to every active journey wired to `event`:
 * resolve-or-create the contact once, then enroll it into each journey.
 * Returns the number of journeys the contact was newly enrolled into.
 */
export const enrollForTrigger = async (
  container: MedusaContainer,
  input: EnrollForTriggerInput
): Promise<{ enrolled: number }> => {
  const tenantId = input.tenantId ?? currentTenantId()

  try {
    const svc: any = container.resolve(MARKETING_MODULE)

    const journeys = await svc.listMarketingJourneys({
      tenant_id: tenantId,
      trigger_event: input.event,
      status: "active",
    })

    if (!journeys?.length) {
      return { enrolled: 0 }
    }

    const contact = await findOrCreateContact(
      container,
      tenantId,
      input.contactRef
    )

    let enrolled = 0
    for (const journey of journeys) {
      // TODO Phase 4: apply segment_filter — v1 enrolls regardless of any
      // journey.segment_filter; segment gating lands in a later phase.
      const result = await enrollContact(container, {
        tenantId,
        journeyId: journey.id,
        contactId: contact?.id ?? null,
        email: input.contactRef.email ?? null,
        customerId: input.contactRef.customerId ?? null,
        context: input.context,
      })
      if (result.enrolled) {
        enrolled += 1
      }
    }

    return { enrolled }
  } catch (e) {
    getLogger(container)?.error?.(
      `[marketing] enrollForTrigger error (swallowed) for event ${input.event}: ${
        (e as any)?.message ?? e
      }`
    )
    return { enrolled: 0 }
  }
}
