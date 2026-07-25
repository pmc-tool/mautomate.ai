/**
 * Meta Graph error → a message a merchant can act on.
 *
 * Meta's generic `message` ("Invalid parameter") hides the useful part:
 * error_user_title/error_user_msg carry the human explanation and
 * error_subcode pinpoints the field. Compose them, and log the full error
 * body server-side so a vague merchant report is always diagnosable.
 */
export const metaErrorText = (
  context: string,
  status: number,
  err: any
): string => {
  // eslint-disable-next-line no-console
  console.error(
    `[ads:meta] ${context} failed (${status}):`,
    JSON.stringify(err ?? {}).slice(0, 600)
  )
  const parts: string[] = []
  if (err?.error_user_title) parts.push(String(err.error_user_title))
  if (err?.error_user_msg) parts.push(String(err.error_user_msg))
  if (!parts.length && err?.message) parts.push(String(err.message))
  if (!parts.length) return `Meta request failed (${status})`
  const detail = [
    err?.error_subcode ? `subcode ${err.error_subcode}` : null,
    err?.code != null && !err?.error_user_msg ? `code ${err.code}` : null,
  ]
    .filter(Boolean)
    .join(", ")
  return detail ? `${parts.join(": ")} (${detail})` : parts.join(": ")
}
