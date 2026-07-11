export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount)
}

export function formatCredits(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

export function formatDiscountValue(d: { type: string; value: number }): string {
  if (d.type === "free_shipping") return "Free shipping"
  if (d.type === "percentage") return `${d.value}%`
  return `$${(Number(d.value) || 0).toFixed(2)}`
}
