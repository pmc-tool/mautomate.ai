import sharp from "sharp"

/**
 * video-generator — turns a still into a short, high-quality motion clip.
 *
 * The engine is Novita's Stable Video Diffusion (SVD-XT): it takes ONE image and
 * synthesises ~4 seconds of natural camera/subject motion from it. This is the
 * commerce-relevant, high-fidelity path — a product photo or a generated hero
 * gently comes alive, instead of the flat AnimateDiff "prompt -> mush" clips.
 *
 * Two entry points the route uses:
 *   animateImage()   — source image  -> SVD-XT      -> mp4   ("Animate an image")
 *   promptToVideo()  — prompt -> SDXL still -> SVD-XT -> mp4  ("From a prompt")
 *
 * The prompt path deliberately reuses the proven SDXL image pipeline for the
 * first frame rather than Novita's raw txt2video checkpoints, because a great
 * still animated by SVD beats a mediocre native text-to-video clip every time.
 *
 * SVD-XT is rigid about geometry, discovered by probing the live API:
 *   - frames_num MUST equal 25 (SVD would be 14); fps MUST equal 6  -> ~4.16s.
 *   - the model is trained on three buckets only: 1024x576, 576x1024, 768x768.
 * We resize the source into the requested bucket (cover) so the subject fills
 * the frame instead of being letter-boxed.
 */

const NOVITA = "https://api.novita.ai/v3"
/** Novita 403s an unknown/default UA (python-urllib). Always send a real one. */
const UA = "mautomate-editor/1.0"

const IMAGE_MODEL = () =>
  process.env.NOVITA_IMAGE_MODEL || "sd_xl_base_1.0.safetensors"

export type Orientation = "landscape" | "portrait" | "square"

/** SVD's three trained buckets — anything else is rejected by the API. */
const BUCKET: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1024, h: 576 },
  portrait: { w: 576, h: 1024 },
  square: { w: 768, h: 768 },
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  if (!r.ok) {
    const detail = j?.metadata?.details || j?.message || j?.reason || `provider ${r.status}`
    throw new Error(detail)
  }
  return j
}

/** Poll an async task to completion. `want` picks which payload we expect. */
async function pollTask(
  key: string,
  taskId: string,
  want: "video" | "image",
  { tries = 90, everyMs = 3000 }: { tries?: number; everyMs?: number } = {}
): Promise<string> {
  for (let i = 0; i < tries; i++) {
    await sleep(everyMs)
    const r = await fetch(`${NOVITA}/async/task-result?task_id=${taskId}`, {
      headers: { Authorization: `Bearer ${key}`, "User-Agent": UA },
    })
    const j: any = await r.json().catch(() => ({}))
    const st = j?.task?.status
    if (st === "TASK_STATUS_SUCCEED") {
      if (want === "video") {
        const url =
          j?.videos?.[0]?.video_url ||
          j?.task?.videos?.[0]?.video_url ||
          j?.videos?.[0]?.url
        if (!url) throw new Error("The video service returned no clip.")
        return url
      }
      const url = (j?.images ?? []).map((im: any) => im.image_url).filter(Boolean)[0]
      if (!url) throw new Error("No image was returned.")
      return url
    }
    if (st === "TASK_STATUS_FAILED") {
      throw new Error(j?.task?.reason || "Generation failed.")
    }
  }
  throw new Error("The video timed out. Try again in a moment.")
}

/** Fetch any image reference (url or data URI) into raw bytes. */
async function toBytes(ref: string): Promise<Buffer> {
  if (ref.startsWith("data:")) {
    const m = /^data:[^;]+;base64,(.+)$/.exec(ref)
    if (!m) throw new Error("bad image data")
    return Buffer.from(m[1], "base64")
  }
  const r = await fetch(ref, { headers: { "User-Agent": UA } })
  if (!r.ok) throw new Error(`could not fetch the image (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

/**
 * Resize a source image into an SVD bucket. `cover` keeps the subject filling
 * the frame (SVD animates what it sees; letter-box bars would animate too).
 * Emits a JPEG so a large PNG source never bloats the request body.
 */
async function fitToBucket(bytes: Buffer, orientation: Orientation): Promise<string> {
  const { w, h } = BUCKET[orientation]
  const out = await sharp(bytes)
    .resize(w, h, { fit: "cover", position: "attention" })
    .jpeg({ quality: 90 })
    .toBuffer()
  return out.toString("base64")
}

export type AnimateOpts = {
  /** 1-255. Higher = more motion. 90 is a tasteful "premium" default. */
  motion?: number
  seed?: number
  steps?: number
}

/**
 * Animate one still into a ~4s SVD-XT clip. `image` is a url or data URI.
 * Returns the provider's temporary mp4 url (the route stores it permanently).
 */
export async function animateImage(
  key: string,
  image: string,
  orientation: Orientation = "landscape",
  opts: AnimateOpts = {}
): Promise<string> {
  const { w, h } = BUCKET[orientation]
  const b64 = await fitToBucket(await toBytes(image), orientation)
  const motion = Math.max(1, Math.min(255, Math.round(opts.motion ?? 90)))

  const task = await novita(
    "/async/img2video",
    {
      model_name: "SVD-XT",
      image_file: b64,
      width: w,
      height: h,
      frames_num: 25, // SVD-XT: fixed at 25
      frames_per_second: 6, // SVD-XT: fixed at 6  -> ~4.16s
      seed: opts.seed ?? -1,
      steps: Math.max(15, Math.min(30, opts.steps ?? 25)),
      motion_bucket_id: motion,
      cond_aug: 0.02,
      enable_frame_interpolation: false,
    },
    key
  )
  const id = task?.task_id
  if (!id) throw new Error("The video service did not accept the request.")
  return await pollTask(key, id, "video")
}

/** SDXL prompt scaffolding for the first frame of a prompt-driven clip. */
const NEG =
  "text, words, letters, watermark, signature, logo, ui, frame, border, blurry, " +
  "low quality, jpeg artifacts, deformed, distorted, extra limbs, bad anatomy, " +
  "cluttered, messy background, oversaturated"

/** Generate a first-frame still from a prompt using the proven SDXL pipeline. */
export async function promptToImage(
  key: string,
  prompt: string,
  orientation: Orientation
): Promise<string> {
  const { w, h } = BUCKET[orientation]
  const full =
    `cinematic ${orientation} photograph of ${prompt}, editorial e-commerce ` +
    `photography, premium brand feel, soft natural light, shallow depth of field, ` +
    `sharp focus, rich detail, motion-ready composition`
  const task = await novita(
    "/async/txt2img",
    {
      extra: { response_image_type: "png" },
      request: {
        model_name: IMAGE_MODEL(),
        prompt: full,
        negative_prompt: NEG,
        width: w,
        height: h,
        image_num: 1,
        steps: 28,
        seed: -1,
        guidance_scale: 7, // REQUIRED by Novita — omitting it 400s.
        sampler_name: "DPM++ 2M Karras",
      },
    },
    key
  )
  const id = task?.task_id
  if (!id) throw new Error("The image stage did not start.")
  return await pollTask(key, id, "image", { tries: 40, everyMs: 2500 })
}

/**
 * Prompt -> mp4. Generates a great still, then animates it. Returns BOTH urls
 * so the route can show/keep the poster frame alongside the clip.
 */
export async function promptToVideo(
  key: string,
  prompt: string,
  orientation: Orientation = "landscape",
  opts: AnimateOpts = {}
): Promise<{ video: string; poster: string }> {
  const poster = await promptToImage(key, prompt, orientation)
  const video = await animateImage(key, poster, orientation, opts)
  return { video, poster }
}
