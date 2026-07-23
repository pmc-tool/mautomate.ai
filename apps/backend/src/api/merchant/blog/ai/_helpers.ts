import { uploadFilesWorkflow } from "@medusajs/core-flows"
import crypto from "crypto"

/**
 * Shared helpers for the merchant blog AI routes (compose / image / video).
 * Generated media is fetched from the vendor's temporary URL and stored
 * DURABLY in the tenant's namespaced bucket before the response returns — a
 * merchant must never end up with a blog post pointing at an expired URL.
 */

const UA = "mAutomate-blog-ai/1.0"

export async function fetchBytes(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { "User-Agent": UA } })
  if (!r.ok) throw new Error(`could not fetch the generated file (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

/** Store bytes in the tenant's namespaced bucket; returns the permanent URL. */
export async function storeBytes(
  scope: any,
  tenantId: string,
  name: string,
  buf: Buffer,
  mime: string
): Promise<string> {
  const { result } = await uploadFilesWorkflow(scope).run({
    input: {
      files: [
        {
          filename: `${tenantId}/${name}-${crypto.randomBytes(4).toString("hex")}`,
          mimeType: mime,
          content: buf.toString("base64"),
          access: "public" as const,
        },
      ],
    },
  })
  const file = (result as Array<{ url: string }>)[0]
  if (!file?.url) throw new Error("could not store the generated file")
  return file.url
}

/** Robust "the model returned JSON somewhere in its answer" parser. */
export function extractJson(text: string): Record<string, any> {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) {
    throw new Error("The AI response was not in the expected format — try again.")
  }
  return JSON.parse(text.slice(start, end + 1))
}
