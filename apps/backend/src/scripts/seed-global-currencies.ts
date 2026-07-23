import { Modules } from "@medusajs/framework/utils"

/**
 * seed-global-currencies — the merchant currency picker (setup wizard + store
 * settings) can only offer currencies the PLATFORM's single global store
 * supports. It shipped supporting only EUR, so every store was stuck on its
 * provisioned default. This adds the common set so a merchant can actually pick
 * their own (BDT, USD, GBP, ...). The existing default is preserved; each tenant
 * still sets its OWN currency on its OWN region + meta — this only widens what's
 * selectable. Idempotent.
 *
 * Run: npx medusa exec ./src/scripts/seed-global-currencies.ts
 */
const WANT = [
  "usd", "eur", "gbp", "bdt", "inr", "pkr", "aud", "cad", "sgd", "aed",
  "myr", "jpy", "cny", "zar", "ngn", "sar", "npr", "lkr", "nzd", "chf",
  "sek", "thb", "php", "idr", "hkd", "try", "kes", "egp", "brl", "mxn",
]

export default async function seedGlobalCurrencies({ container }: any) {
  const logger = container.resolve("logger")
  const storeModule: any = container.resolve(Modules.STORE)

  const [store] = await storeModule.listStores({}, { take: 1 })
  if (!store) {
    logger.error("[seed-currencies] no store found")
    return
  }

  const existing = new Map<string, any>(
    (store.supported_currencies || []).map((c: any) => [c.currency_code, c])
  )

  const merged: { currency_code: string; is_default?: boolean }[] = []
  const seen = new Set<string>()
  const add = (code: string, is_default: boolean) => {
    if (seen.has(code)) return
    seen.add(code)
    merged.push({ currency_code: code, is_default })
  }
  // keep every existing currency (preserving its default flag) ...
  for (const [code, c] of existing) add(code, !!c.is_default)
  // ... then add the wanted ones (non-default)
  for (const code of WANT) add(code, false)
  // exactly one default is required
  if (!merged.some((c) => c.is_default)) merged[0].is_default = true

  await storeModule.updateStores(store.id, { supported_currencies: merged })
  logger.info(
    `[seed-currencies] global store now supports ${merged.length} currencies (default: ${
      merged.find((c) => c.is_default)?.currency_code
    })`
  )
}
