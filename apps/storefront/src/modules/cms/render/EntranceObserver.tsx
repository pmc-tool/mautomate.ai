"use client"

/* ------------------------------------------------------------------ */
/* EntranceObserver — the tiny JS half of entrance-on-scroll (F3)       */
/*                                                                     */
/* Mounted ONCE per page (production section-renderer AND the editor    */
/* canvas) whenever any section carries an entrance animation. On mount */
/* it adds `ff-io` to <html> — the gate every hiding rule in            */
/* ENTRANCE_CSS requires — then observes every `[data-anim]` wrapper    */
/* and adds `ff-in` when it scrolls into view (unobserving after, so    */
/* each section animates once).                                          */
/*                                                                      */
/* SAFETY: without this component (or with JS disabled / before          */
/* hydration) `ff-io` is never set, so ENTRANCE_CSS hides NOTHING and    */
/* the page renders exactly as today. The class flips happen via         */
/* classList (outside React-managed attributes), so there is zero        */
/* hydration risk. Renders null.                                         */
/* ------------------------------------------------------------------ */

import { useEffect } from "react"

export default function EntranceObserver({
  watch,
}: {
  /**
   * Optional re-scan trigger. The editor canvas passes its sections array so
   * newly added / re-rendered `[data-anim]` wrappers are (re-)observed instead
   * of staying stuck at opacity 0. Production leaves it unset (scan on mount).
   */
  watch?: unknown
}) {
  // Gate the hiding CSS on <html> for the lifetime of the component. Kept as a
  // separate effect so `watch`-driven re-scans never flash the gate off.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return
    }
    document.documentElement.classList.add("ff-io")
    return () => {
      document.documentElement.classList.remove("ff-io")
    }
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("ff-in")
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15 }
    )
    document.querySelectorAll("[data-anim]").forEach((el) => io.observe(el))
    return () => {
      io.disconnect()
    }
  }, [watch])

  return null
}
