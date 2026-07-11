import {
  getCurrentTenantId,
  resolveTenantId,
} from "../../../lib/tenant-context"
import { promises as fs } from "fs"
import os from "os"
import path from "path"

import { uploadFilesWorkflow } from "@medusajs/core-flows"
import { tenantScopedUploadFilename } from "../../../lib/tenant-upload"
import type { MedusaContainer } from "@medusajs/framework/types"

import { MARKETING_MODULE } from ".."
import type MarketingModuleService from "../service"
import { getAiTtsProvider } from "../ai/registry"
import { getCommerceGateway } from "../gateway"
import { hasFfmpeg, probeDuration, runFfmpeg } from "./ffmpeg"

/**
 * studio/video-service — the ffmpeg slideshow "workhorse" that turns a product's
 * images + an AI voiceover + captions into a short marketing MP4.
 *
 * Design goals (in priority order):
 *   1. RELIABILITY. ffmpeg and the TTS key are both optional. A missing ffmpeg
 *      is a clean, friendly error (never a crash/hang). A missing/failing TTS
 *      key degrades to a silent (or music) track. A missing font degrades to a
 *      no-caption render (the caption pass is retried away, never fatal).
 *   2. CLEANUP. Everything happens in a per-render temp dir removed in a finally.
 *   3. TENANCY. Every persisted row carries `tenant_id`.
 *
 * The whole slideshow is composed in ONE ffmpeg invocation via a `concat`
 * filter graph (no intermediate segment files, no concat-demuxer timestamp
 * drift): each still is looped for its scene duration, scaled to fit inside the
 * target WxH and letterboxed on black, an optional caption is burned in with
 * `drawtext` (from a `textfile=` so no filter-string escaping can bite us), and
 * all scenes are concatenated. A voiceover (or music) track is muxed in and the
 * output is trimmed with `-shortest`.
 */

/** Target pixel dimensions per aspect preset. All even (H.264-safe). */
export const ASPECT_PRESETS = {
  reel_9x16: { w: 1080, h: 1920 },
  square_1x1: { w: 1080, h: 1080 },
  landscape_16x9: { w: 1920, h: 1080 },
} as const

export type AspectKey = keyof typeof ASPECT_PRESETS

/** Fallback per-scene duration (seconds) when no audio drives the timing. */
const DEFAULT_SCENE_SECONDS = 3.5

/** Hard cap on auto-built scenes, to keep renders quick. */
const MAX_SCENES = 6

const currentTenantId = (): string =>
  getCurrentTenantId() ??
  // Fail-closed: a rendered video must never land on the shared "default"
  // tenant key. Reject the write when no tenant is resolvable.
  resolveTenantId("MARKETING_DEFAULT_TENANT", { allowDefault: false })

/** A single resolved scene ready to render. */
type ResolvedScene = {
  imageUrl: string
  caption: string
  script: string
}

/** Input scene as supplied by the caller (all fields optional). */
export type SceneInput = {
  imageUrl?: string
  caption?: string
  script?: string
}

export type GenerateProductVideoInput = {
  tenantId?: string
  productId: string
  aspect?: string
  scenes?: SceneInput[]
  voice?: string
  addVoiceover?: boolean
  musicUrl?: string
}

/** Normalize an arbitrary aspect string to a known preset key (default reel). */
const resolveAspect = (aspect?: string): AspectKey => {
  if (aspect && aspect in ASPECT_PRESETS) {
    return aspect as AspectKey
  }
  return "reel_9x16"
}

/** Format a representative price line for a caption/script (best-effort). */
const formatPrice = (
  price: number | null | undefined,
  currency: string | null | undefined
): string | null => {
  if (price === null || price === undefined || Number.isNaN(price)) {
    return null
  }
  const cur = currency ? currency.toUpperCase() : ""
  return `${cur} ${price}`.trim()
}

/** Split a description into short trimmed sentences (for per-scene captions). */
const sentences = (text: string | null | undefined): string[] => {
  if (!text) {
    return []
  }
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Download a URL to `dest`; resolves false (never throws) on any failure. */
const downloadTo = async (url: string, dest: string): Promise<boolean> => {
  try {
    const res = await fetch(url)
    if (!res.ok) {
      return false
    }
    const bytes = Buffer.from(await res.arrayBuffer())
    if (!bytes.length) {
      return false
    }
    await fs.writeFile(dest, bytes)
    return true
  } catch {
    return false
  }
}

/** Build the per-input drawtext caption filter fragment. */
const drawtextFor = (textfile: string, h: number): string => {
  const font = process.env.FFMPEG_FONT
  const fontPart = font ? `fontfile='${font}':` : ""
  const fontsize = Math.max(18, Math.round(h / 24))
  const margin = Math.round(h / 10)
  return (
    `drawtext=${fontPart}textfile='${textfile}':` +
    `fontcolor=white:fontsize=${fontsize}:` +
    `box=1:boxcolor=black@0.45:boxborderw=18:` +
    `x=(w-text_w)/2:y=h-text_h-${margin}:line_spacing=8`
  )
}

/** Build the full filter_complex for the slideshow (optionally with captions). */
const buildFilter = (
  scenes: { captionFile: string | null }[],
  w: number,
  h: number,
  withCaptions: boolean
): string => {
  const parts: string[] = []
  const labels: string[] = []
  scenes.forEach((s, i) => {
    let chain =
      `[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
      `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p`
    if (withCaptions && s.captionFile) {
      chain += `,${drawtextFor(s.captionFile, h)}`
    }
    chain += `[v${i}]`
    parts.push(chain)
    labels.push(`[v${i}]`)
  })
  parts.push(
    `${labels.join("")}concat=n=${scenes.length}:v=1:a=0[outv]`
  )
  return parts.join(";")
}

/**
 * Generate a short marketing MP4 for a product and persist it.
 *
 * Returns the created `video-project` row and the public URL of the MP4. Throws
 * a clean Error when ffmpeg is unavailable, the product can't be resolved, or
 * the render fails (a "failed" project row is persisted first so the UI can show
 * the reason).
 */
export const generateProductVideo = async (
  container: MedusaContainer,
  input: GenerateProductVideoInput
): Promise<{ project: any; url: string }> => {
  const tenantId = input.tenantId ?? currentTenantId()
  const aspectKey = resolveAspect(input.aspect)
  const { w, h } = ASPECT_PRESETS[aspectKey]

  // 1) ffmpeg must be present, else a clean, friendly error (route maps it).
  if (!(await hasFfmpeg())) {
    throw new Error(
      "Video rendering is unavailable: ffmpeg is not installed on the server."
    )
  }

  // 2) Resolve the product and build scenes.
  const gateway = getCommerceGateway(container)
  const product = await gateway.getProduct(tenantId, input.productId)
  if (!product) {
    throw new Error(`Product ${input.productId} was not found.`)
  }

  const productImages =
    product.images && product.images.length
      ? product.images
      : product.thumbnail
      ? [product.thumbnail]
      : []
  const priceLine = formatPrice(product.price, product.currency_code)
  const descLines = sentences(product.description)

  let scenes: ResolvedScene[]
  if (input.scenes && input.scenes.length) {
    scenes = input.scenes.slice(0, MAX_SCENES).map((s, i) => {
      const imageUrl =
        s.imageUrl ?? productImages[i] ?? productImages[0] ?? ""
      const caption =
        s.caption ??
        (i === 0
          ? [product.title, priceLine].filter(Boolean).join("\n")
          : descLines[i - 1] ?? product.title ?? "")
      const script =
        s.script ??
        (i === 0
          ? [product.title, priceLine].filter(Boolean).join(". ")
          : descLines[i - 1] ?? product.title ?? "")
      return { imageUrl, caption: caption ?? "", script: script ?? "" }
    })
  } else {
    scenes = productImages.slice(0, MAX_SCENES).map((imageUrl, i) => {
      const caption =
        i === 0
          ? [product.title, priceLine].filter(Boolean).join("\n")
          : descLines[i - 1] ?? product.title ?? ""
      const script =
        i === 0
          ? [product.title, priceLine].filter(Boolean).join(". ")
          : descLines[i - 1] ?? product.title ?? ""
      return { imageUrl, caption: caption ?? "", script: script ?? "" }
    })
  }

  scenes = scenes.filter((s) => s.imageUrl)
  if (!scenes.length) {
    throw new Error(
      "Cannot render a video: the product has no usable images."
    )
  }

  const svc: MarketingModuleService = container.resolve(MARKETING_MODULE)

  // Persist a "rendering" project up front so render failures can be recorded.
  const sceneMeta = scenes.map((s, i) => ({
    position: i,
    caption: s.caption,
    script: s.script,
    image_url: s.imageUrl,
  }))
  const createdProject = await svc.createMarketingVideoProjects({
    tenant_id: tenantId,
    title: product.title ?? "Product video",
    status: "rendering",
    aspect_ratio: aspectKey,
    provider: "ffmpeg",
    product_id: input.productId,
    params: { aspect: aspectKey, scenes: sceneMeta },
  } as any)
  const project = Array.isArray(createdProject)
    ? createdProject[0]
    : createdProject

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "mkt-video-"))

  try {
    // 3) Download each scene image.
    const localScenes: {
      imagePath: string
      captionFile: string | null
      script: string
      caption: string
    }[] = []
    for (let i = 0; i < scenes.length; i++) {
      const s = scenes[i]
      const imgPath = path.join(tmpDir, `scene-${i}.img`)
      const ok = await downloadTo(s.imageUrl, imgPath)
      if (!ok) {
        continue
      }
      let captionFile: string | null = null
      if (s.caption && s.caption.trim()) {
        captionFile = path.join(tmpDir, `cap-${i}.txt`)
        await fs.writeFile(captionFile, s.caption.trim())
      }
      localScenes.push({
        imagePath: imgPath,
        captionFile,
        script: s.script,
        caption: s.caption,
      })
    }

    if (!localScenes.length) {
      throw new Error("None of the product images could be downloaded.")
    }

    // 4) Optional voiceover — synthesize one narration from the scripts.
    let audioPath: string | null = null
    let audioDuration: number | null = null
    if (input.addVoiceover) {
      const tts = getAiTtsProvider()
      if (tts) {
        const narration = localScenes
          .map((s) => (s.script || s.caption || "").trim())
          .filter(Boolean)
          .join(". ")
        if (narration) {
          try {
            const result = await tts.generate(narration, {
              voice: input.voice,
              format: "mp3",
            })
            if (result?.b64) {
              const p = path.join(tmpDir, "voiceover.mp3")
              await fs.writeFile(p, Buffer.from(result.b64, "base64"))
              audioPath = p
            } else if (result?.url) {
              const p = path.join(tmpDir, "voiceover.mp3")
              if (await downloadTo(result.url, p)) {
                audioPath = p
              }
            }
          } catch {
            // TTS failure is non-fatal: fall through to a silent/music track.
            audioPath = null
          }
        }
      }
    }

    // Optional background music (only used when there is no voiceover).
    if (!audioPath && input.musicUrl) {
      const p = path.join(tmpDir, "music.mp3")
      if (await downloadTo(input.musicUrl, p)) {
        audioPath = p
      }
    }

    if (audioPath) {
      audioDuration = await probeDuration(audioPath)
    }

    // 5) Per-scene duration: split audio across scenes, else the default.
    const perScene =
      audioDuration && audioDuration > 0
        ? Math.max(1.5, audioDuration / localScenes.length)
        : DEFAULT_SCENE_SECONDS

    const outputPath = path.join(tmpDir, "output.mp4")

    const runRender = async (withCaptions: boolean): Promise<void> => {
      const args: string[] = []
      for (const s of localScenes) {
        args.push("-loop", "1", "-t", perScene.toFixed(3), "-i", s.imagePath)
      }
      if (audioPath) {
        args.push("-i", audioPath)
      }
      args.push("-filter_complex", buildFilter(localScenes, w, h, withCaptions))
      args.push("-map", "[outv]")
      if (audioPath) {
        args.push("-map", `${localScenes.length}:a`)
      }
      args.push(
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-movflags",
        "+faststart"
      )
      if (audioPath) {
        args.push("-c:a", "aac", "-b:a", "128k", "-shortest")
      }
      args.push("-y", outputPath)
      await runFfmpeg(args)
    }

    const wantCaptions = localScenes.some((s) => s.captionFile)
    try {
      await runRender(wantCaptions)
    } catch (renderErr) {
      // A caption pass can fail on hosts without a usable font — retry clean.
      if (wantCaptions) {
        await runRender(false)
      } else {
        throw renderErr
      }
    }

    // 6) Upload the MP4 and finalize the project + scene rows.
    const mp4 = await fs.readFile(outputPath)
    const { result: uploaded } = await uploadFilesWorkflow(container).run({
      input: {
        files: [
          {
            filename: tenantScopedUploadFilename(
              tenantId,
              `marketing-video-${project.id}.mp4`
            ),
            mimeType: "video/mp4",
            content: mp4.toString("base64"),
            access: "public" as const,
          },
        ],
      },
    })
    const file = (uploaded as { id: string; url: string }[])[0]

    await svc.updateMarketingVideoProjects({
      id: project.id,
      status: "ready",
      output_file_id: file.id,
      params: { aspect: aspectKey, url: file.url, scenes: sceneMeta },
    } as any)

    await svc.createMarketingVideoScenes(
      localScenes.map((s, i) => ({
        tenant_id: tenantId,
        project_id: project.id,
        position: i,
        script: s.script || null,
        image_file_id: null,
        voiceover_file_id: null,
        duration: perScene,
      })) as any
    )

    const finalProject = await svc.retrieveMarketingVideoProject(project.id)

    return { project: finalProject ?? project, url: file.url }
  } catch (err: any) {
    // Persist the failure reason so the UI can surface it, then rethrow clean.
    const message =
      err instanceof Error ? err.message : String(err ?? "render failed")
    try {
      await svc.updateMarketingVideoProjects({
        id: project.id,
        status: "failed",
        params: { aspect: aspectKey, scenes: sceneMeta, error: message },
      } as any)
    } catch {
      // Best-effort — never mask the original error.
    }
    throw new Error(message)
  } finally {
    // 7) Always clean up the temp dir.
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
