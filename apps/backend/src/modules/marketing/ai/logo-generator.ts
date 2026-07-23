import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { tenantScopedUploadFilename } from "../../../lib/tenant-upload"

/**
 * Setup-wizard logo generation.
 *
 * A focused reuse of the same Novita pipeline the visual editor uses for logos
 * (txt2img on a flat white field -> remove-background -> transparent PNG), so a
 * non-technical merchant can get a usable brand mark from a sentence. Kept as a
 * small self-contained helper (rather than importing the editor route, which is
 * gated by the editor token) so the merchant-authed setup route can call it
 * directly. The prompt scaffolding — not the API call — is the quality lever, so
 * the logo recipe below mirrors the editor's.
 */

const NOVITA = "https://api.novita.ai/v3"
const UA = "mautomate-setup/1.0"
const MODEL = () => process.env.NOVITA_IMAGE_MODEL || "sd_xl_base_1.0.safetensors"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const LOGO_PRE = "professional minimal vector logo mark of"
const LOGO_POST =
  ", flat vector, simple geometric shapes, bold clean silhouette, centered, " +
  "single solid colour on a pure flat white background, high contrast, no gradients, no 3d, iconic, memorable"
const LOGO_NEG =
  "text, words, letters, watermark, signature, caption, ui, frame, border, " +
  "blurry, low quality, jpeg artifacts, deformed, distorted, photo, photorealistic, " +
  "texture, shadow, gradient, mockup, business card, 3d render, cluttered detail"

async function novita(path: string, body: unknown, key: string): Promise<any> {
  const r = await fetch(`${NOVITA}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify(body),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j?.message || j?.reason || `provider ${r.status}`)
  return j
}

async function fetchBuf(url: string): Promise<Buffer> {
  const r = await fetch(url, { headers: { "User-Agent": UA } })
  if (!r.ok) throw new Error(`could not fetch image (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

/** Remove the flat white background; returns a transparent PNG buffer. */
async function removeBg(key: string, url: string): Promise<Buffer> {
  const b64 = (await fetchBuf(url)).toString("base64")
  const j = await novita(
    "/remove-background",
    { image_file: b64, extra: { response_image_type: "png" } },
    key
  )
  const out = j?.image_file || j?.image || j?.images?.[0]?.image_file
  if (!out) throw new Error("Background removal returned nothing.")
  return Buffer.from(out, "base64")
}

/** Submit txt2img for a logo and poll to completion. Returns temporary URLs. */
async function txt2imgLogo(key: string, subject: string, count: number): Promise<string[]> {
  const full = `${LOGO_PRE} ${subject}${LOGO_POST}`
  const task = await novita(
    "/async/txt2img",
    {
      extra: { response_image_type: "png" },
      request: {
        model_name: MODEL(),
        prompt: full,
        negative_prompt: LOGO_NEG,
        width: 1024,
        height: 1024,
        image_num: Math.max(1, Math.min(4, count)),
        steps: 30,
        seed: -1,
        guidance_scale: 7.5, // REQUIRED by Novita — omitting it is a 400.
        sampler_name: "DPM++ 2M Karras",
      },
    },
    key
  )
  const id = task?.task_id
  if (!id) throw new Error("The image service did not accept the request.")

  for (let i = 0; i < 40; i++) {
    await sleep(2500)
    const r = await fetch(`${NOVITA}/async/task-result?task_id=${id}`, {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": UA },
    })
    const j: any = await r.json().catch(() => ({}))
    const st = j?.task?.status
    if (st === "TASK_STATUS_SUCCEED") {
      const urls = (j.images ?? []).map((im: any) => im.image_url).filter(Boolean)
      if (!urls.length) throw new Error("No images were returned.")
      return urls
    }
    if (st === "TASK_STATUS_FAILED") {
      throw new Error(j?.task?.reason || "Logo generation failed.")
    }
  }
  throw new Error("Logo generation timed out.")
}

/**
 * Generate `count` logo options for a tenant and store each as a permanent,
 * tenant-namespaced public PNG. Returns the stored URLs. Throws if Novita is not
 * configured or produced nothing.
 */
export async function generateSetupLogos(
  scope: any,
  tenantId: string,
  opts: { brandName?: string; category?: string; prompt?: string; count?: number }
): Promise<string[]> {
  const key = process.env.NOVITA_API_KEY
  if (!key) throw new Error("Logo generation is not configured.")

  const count = Math.max(1, Math.min(4, opts.count ?? 2))
  const subject =
    opts.prompt && opts.prompt.trim()
      ? opts.prompt.trim()
      : [opts.brandName, opts.category].filter(Boolean).join(", ") || "a modern brand"

  const urls = await txt2imgLogo(key, subject, count)

  const stored: string[] = []
  for (let i = 0; i < urls.length; i++) {
    let buf: Buffer
    try {
      buf = await removeBg(key, urls[i])
    } catch {
      // Background removal is a nicety — never lose the logo over it.
      buf = await fetchBuf(urls[i])
    }
    const { result } = await uploadFilesWorkflow(scope).run({
      input: {
        files: [
          {
            filename: tenantScopedUploadFilename(tenantId, `setup-logo-${i}.png`),
            mimeType: "image/png",
            content: buf.toString("base64"),
            access: "public" as const,
          },
        ],
      },
    })
    const url = (result as Array<{ url?: string }>)?.[0]?.url
    if (url) stored.push(url)
  }

  if (!stored.length) throw new Error("No logo could be generated.")
  return stored
}
