import { CMS_DEFAULTS, getCmsSettings } from "@lib/data/cms"
import {
  buildChromeCss,
  chromeHasStyle,
  type ChromeRegion,
} from "@modules/cms/render/style-engine"

/**
 * F1 CHROME STYLING — production injection.
 *
 * Reads the global CMS chrome settings (the topbar / header / footer objects,
 * which now MAY carry `style` / `advanced` / `elementStyles`) and, for every
 * region that actually holds style, emits a `<style>` with the scoped CSS from
 * the shared `buildChromeCss`. This is the SAME serializer the editor canvas
 * uses, targeting the SAME stable per-region class `.cms-chrome-<region>` (and
 * `.cms-chrome-<region> [data-el="<key>"]` for element overrides) that the real
 * header / top-bar / footer components already carry — so the live storefront
 * applies chrome styling byte-for-byte identically to the editor.
 *
 * `getCmsSettings` is React-`cache()`d, so this shares the single request-scoped
 * fetch already made by <Nav> and <Footer> — no extra network call. When no
 * region carries style (the case for every store until a user authors chrome
 * styling) this renders nothing, leaving output visually unchanged.
 */
export default async function ChromeStyles() {
  const settings = await getCmsSettings().catch(() => CMS_DEFAULTS)

  const regions: { region: ChromeRegion; bag: unknown }[] = [
    { region: "topbar", bag: settings?.topbar },
    { region: "header", bag: settings?.header },
    { region: "footer", bag: settings?.footer },
  ]

  const styleTags = regions
    .map(({ region, bag }) => {
      const b = (bag ?? {}) as {
        style?: any
        advanced?: any
        elementStyles?: any
      }
      if (!chromeHasStyle(b.style, b.advanced, b.elementStyles)) {
        return null
      }
      const css = buildChromeCss(region, b.style, b.advanced, b.elementStyles)
      if (!css) {
        return null
      }
      return { region, css }
    })
    .filter((x): x is { region: ChromeRegion; css: string } => x !== null)

  if (!styleTags.length) {
    return null
  }

  return (
    <>
      {styleTags.map(({ region, css }) => (
        <style
          key={`cms-chrome-${region}`}
          data-cms-chrome-css={region}
          dangerouslySetInnerHTML={{ __html: css }}
        />
      ))}
    </>
  )
}
