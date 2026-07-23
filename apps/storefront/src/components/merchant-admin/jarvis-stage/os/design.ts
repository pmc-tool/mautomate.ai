"use client"

/* ------------------------------------------------------------------ */
/* Pixi OS design flag — the v2 "quiet sun" look vs the classic look.  */
/*                                                                     */
/* Runtime-switchable (localStorage, no rebuild): the merchant can flip    */
/* between designs from the surface header at any time. Default is v2;      */
/* "classic" preserves the original look pixel-for-pixel. Components read     */
/* the flag via useJarvisDesign() and branch presentationally only — state,    */
/* cards, voice and streaming behaviour are identical in both designs.          */
/* ------------------------------------------------------------------ */

export type JarvisDesign = "v2" | "classic"

// The v2 "quiet sun" design is now THE design (user retired the classic look
// 2026-07-19). The hook keeps its old signature so every consumer stays
// untouched; classic branches in components are dead code kept only as the
// emergency fallback (*.bak-jdesign files hold the pre-v2 originals).
export function getJarvisDesign(): JarvisDesign {
  return "v2"
}

export function setJarvisDesign(_d: JarvisDesign) {
  /* no-op — the classic look is retired */
}

export function useJarvisDesign(): [JarvisDesign, (d: JarvisDesign) => void] {
  return ["v2", setJarvisDesign]
}
