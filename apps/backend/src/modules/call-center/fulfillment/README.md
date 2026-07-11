# Call-Center Fulfillment Gate

This directory is the call-center's **fulfillment gate** — the layer that decides
whether a placed order is allowed to ship, and holds the risky ones back until a
human confirms them (primarily for Cash-on-Delivery).

## Why this module exists: Medusa has NO native payment -> fulfillment gate

We verified this against Medusa's own order-fulfillment path. When an order is
fulfilled, the create-fulfillment workflow runs a validation step that checks
**only**:

- the order is **not cancelled**,
- the requested **items exist on the order** and the quantities are fulfillable
  (nothing over-ships), and
- the items can be **grouped** into a valid shipment.

It does **not** consult payment status, and there is no built-in "do not fulfill
this order yet" flag. In other words, Medusa will happily let an unpaid COD order
be fulfilled — nothing native stops it.

So **this module is the gate.** The rule it enforces is simple and lives entirely
in order metadata:

> **Nothing may fulfill an order while `metadata.cc_fulfillment_hold === true`.**

Because the flag is a call-center construct (not a backend feature), enforcement
is **our** responsibility at every fulfillment entry point.

## Where the flag must be checked

Any code path that can turn an order into a shipment must read the hold first and
refuse when it is set:

- **The AI dialer / auto-fulfillment path** — before it triggers a fulfillment,
  it must call `gateway.isFulfillmentHeld(tenantId, orderId)` (or read
  `metadata.cc_fulfillment_hold`) and skip held orders.
- **The admin dashboard** — an admin who clicks "Create fulfillment" on a held
  order must be warned/blocked. Since Medusa's own admin does not know about this
  flag, that check has to be added on our side (an admin widget, a guard in a
  custom fulfillment route, or a subscriber that vetoes fulfillment for held
  orders). Treat `cc_fulfillment_hold === true` as "not shippable yet".
- **Any custom fulfillment workflow/route we add** — must gate on the same flag
  before creating a fulfillment.

The flag is read via the gateway so no call site depends on Medusa directly:

```ts
const held = await gateway.isFulfillmentHeld(tenantId, orderId)
if (held) {
  // refuse to fulfill
}
```

## How the pieces fit together

### `risk.ts` — the decision (pure)

`scoreOrderRisk(input)` is a pure, deterministic scorer that maps assembled
signals (phone reuse across cancelled COD orders, address blocklist, high-value
first-time buyer) onto a band: `low` / `medium` / `hard`.
`shouldHoldForConfirmation(band)` says `medium` and `hard` hold; `low`
auto-releases. No side effects, no I/O — trivially unit-testable.

### `gate-service.ts` — the enforcement (writes the flag)

`FulfillmentGateService` is the ONE place that sets or clears
`cc_fulfillment_hold`. It is no-throw: methods catch backend errors and return a
structured result so the order-placed path / dialer is never broken by a
transient failure.

- **`evaluateAndHold(tenantId, orderId, riskInput)`** — called on the
  order-placed path. Scores the order, then `markFulfillmentHold(..., true)` for
  `medium`/`hard`, or `markFulfillmentHold(..., false)` (auto-release) for `low`.
  Returns the band + reasons so the caller can log why.
- **`autoReleaseIfUnreachable(tenantId, orderId)`** — called by the dialer AFTER
  its max confirmation attempts. Drops the hold and tags the order
  (`cc_auto_released_unreachable`) so a genuinely unreachable-but-legit COD order
  is never stranded on hold forever.

### `src/workflows/call-center/*` — the human outcomes (compensated)

The two workflows are the sanctioned outcomes of a confirmation call. They are
`createWorkflow` flows with a single compensated `createStep`:

- **`confirm-cod-order`** (`call-center-confirm-cod-order`) — the customer
  confirmed. Reads the current hold state, **releases** the hold
  (`markFulfillmentHold(..., false)`) and stamps
  `cc_cod_confirmation_status: "confirmed"` + `cc_confirmed_at`. If a later part
  of the run fails, the **compensation re-applies the hold** so an unconfirmed
  order is never left shippable by a half-finished run. After this workflow the
  order is eligible to fulfill (the flag is cleared).
- **`cancel-cod-order`** (`call-center-cancel-cod-order`) — the customer declined
  / was unreachable and we give up. Records `cc_cancel_reason` in metadata, then
  cancels the order via `gateway.cancelOrder`. Compensation is **best-effort /
  log-only**: a cancel generally cannot be un-cancelled, so on failure we log for
  manual review rather than attempting a reversal.

### End-to-end flow

1. **Order placed** -> caller assembles risk signals -> `evaluateAndHold`.
   - `low` -> hold cleared, order ships normally.
   - `medium` / `hard` -> `cc_fulfillment_hold = true`, order is gated.
2. **Held order** -> every fulfillment path (dialer, admin, custom route) checks
   `isFulfillmentHeld` and refuses to ship.
3. **Confirmation call** resolves the hold:
   - confirmed -> `confirm-cod-order` clears the hold -> order can fulfill.
   - declined -> `cancel-cod-order` cancels the order.
   - unreachable after max attempts -> `autoReleaseIfUnreachable` clears the hold
     and tags it, so a legit order is not stranded.

The invariant throughout: **as long as `cc_fulfillment_hold === true`, nothing
ships.** Everything in this module exists to set that flag correctly and to make
sure every fulfillment path honors it.
