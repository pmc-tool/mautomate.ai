import { spawn } from "child_process"

/**
 * studio/ffmpeg — a tiny, dependency-free wrapper around the `ffmpeg` /
 * `ffprobe` binaries. We deliberately shell out (NO fluent-ffmpeg) so the
 * studio stays dependency-light and works with whatever ffmpeg the deploy host
 * provides.
 *
 * Binary paths come from env so a host can pin an absolute path:
 *   - FFMPEG_PATH  — defaults to "ffmpeg"  (on PATH).
 *   - FFPROBE_PATH — defaults to "ffprobe" (on PATH).
 *
 * Every helper degrades gracefully: `hasFfmpeg()` resolves false when the
 * binary is absent (ENOENT) rather than throwing, and `runFfmpeg` rejects with
 * a clean Error carrying the tail of stderr so callers can persist a reason.
 */

/** Resolve the ffmpeg binary path (env override, else PATH lookup). */
const ffmpegBin = (): string => process.env.FFMPEG_PATH ?? "ffmpeg"

/** Resolve the ffprobe binary path (env override, else PATH lookup). */
const ffprobeBin = (): string => process.env.FFPROBE_PATH ?? "ffprobe"

/** Keep only the last `n` lines of a (possibly long) stderr blob. */
const tail = (text: string, n = 20): string =>
  text.split("\n").filter(Boolean).slice(-n).join("\n")

/**
 * Run ffmpeg with `args`. Resolves on exit code 0, rejects with a clean Error
 * (message includes the tail of stderr) on any non-zero exit or spawn failure.
 */
export const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((resolve, reject) => {
    let stderr = ""
    let settled = false

    const child = spawn(ffmpegBin(), args, {
      stdio: ["ignore", "ignore", "pipe"],
    })

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString()
      // Bound memory on very chatty renders.
      if (stderr.length > 64_000) {
        stderr = stderr.slice(-64_000)
      }
    })

    child.on("error", (err) => {
      if (settled) {
        return
      }
      settled = true
      reject(
        new Error(
          `[marketing] ffmpeg failed to start (${
            (err as NodeJS.ErrnoException).code ?? err.message
          })`
        )
      )
    })

    child.on("close", (code) => {
      if (settled) {
        return
      }
      settled = true
      if (code === 0) {
        resolve()
        return
      }
      reject(
        new Error(
          `[marketing] ffmpeg exited with code ${code}: ${tail(stderr)}`
        )
      )
    })
  })

/**
 * Whether an ffmpeg binary is invokable. Spawns `ffmpeg -version` and resolves
 * false on ENOENT (or any spawn/exit failure), true on a clean exit. Never
 * throws — callers use it to fail fast with a friendly message.
 */
export const hasFfmpeg = (): Promise<boolean> =>
  new Promise((resolve) => {
    let settled = false
    const done = (ok: boolean) => {
      if (settled) {
        return
      }
      settled = true
      resolve(ok)
    }

    try {
      const child = spawn(ffmpegBin(), ["-version"], {
        stdio: "ignore",
      })
      child.on("error", () => done(false))
      child.on("close", (code) => done(code === 0))
    } catch {
      done(false)
    }
  })

/**
 * Probe the duration (in seconds) of a media file via ffprobe. Resolves null
 * when ffprobe is missing or the value can't be parsed — callers then fall back
 * to a fixed per-scene duration. Never throws.
 */
export const probeDuration = (filePath: string): Promise<number | null> =>
  new Promise((resolve) => {
    let out = ""
    let settled = false
    const done = (val: number | null) => {
      if (settled) {
        return
      }
      settled = true
      resolve(val)
    }

    try {
      const child = spawn(
        ffprobeBin(),
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          filePath,
        ],
        { stdio: ["ignore", "pipe", "ignore"] }
      )
      child.stdout?.on("data", (chunk) => {
        out += chunk.toString()
      })
      child.on("error", () => done(null))
      child.on("close", () => {
        const parsed = parseFloat(out.trim())
        done(Number.isFinite(parsed) && parsed > 0 ? parsed : null)
      })
    } catch {
      done(null)
    }
  })
