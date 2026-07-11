import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Forever Finds branding for the admin LOGIN page.
 *
 * The login screen ships inside the compiled @medusajs/dashboard package, so it
 * can't be edited directly — but it exposes the `login.before` widget zone.
 * This widget (a) renders the Forever Finds wordmark above the form, (b) hides
 * the built-in Medusa logo box via a scoped <style> (the dashboard renders it
 * with an `avatar-box` class), and (c) rewrites the "Welcome to Medusa"
 * heading. All source-level — survives reinstalls, no package patching.
 */
const LoginBrand = () => {
  useEffect(() => {
    const brand = () => {
      // Rewrite the built-in heading ("Welcome to Medusa" → Forever Finds).
      let heading: Element | null = null
      document.querySelectorAll("h1, h2").forEach((h) => {
        if (/welcome to/i.test(h.textContent ?? "")) {
          heading = h
          if (/medusa/i.test(h.textContent ?? "")) {
            h.textContent = "Welcome to Forever Finds"
          }
        }
      })
      // Hide the Medusa logo box: it renders as a sibling BEFORE the heading's
      // wrapper in the login column. Walk preceding siblings and hide any that
      // contain an svg/img (structural — no reliance on hashed class names).
      const wrapper = heading ? (heading as Element).closest("div") : null
      let sib = wrapper?.previousElementSibling ?? null
      while (sib) {
        if (sib.querySelector("svg, img") || sib.tagName === "SVG") {
          ;(sib as HTMLElement).style.display = "none"
        }
        sib = sib.previousElementSibling
      }
      document.title = "Forever Finds — Sign in"
    }
    // Run now and retry briefly in case the login column renders late.
    brand()
    const t1 = setTimeout(brand, 300)
    const t2 = setTimeout(brand, 1200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <>
      {/* Hide the Medusa logo box while this widget is mounted (login only). */}
      <style>{`[class*="avatar-box"]{display:none!important}`}</style>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontFamily: "Marcellus, Georgia, serif",
            fontSize: 32,
            letterSpacing: 1,
            color: "#72a499",
            lineHeight: 1,
          }}
        >
          forever finds
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#9ca3af",
          }}
        >
          Store Admin
        </span>
      </div>
    </>
  )
}

export const config = defineWidgetConfig({
  zone: "login.before",
})

export default LoginBrand
