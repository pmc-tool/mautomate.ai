import { font, ink, radius, shadow } from "./design"

/** Compact card drag-image (WS5) — a small dark chip instead of the full DOM node. */
export function setCardDragImage(e: React.DragEvent, label: string) {
  try {
    const el = document.createElement("div")
    el.textContent = label
    Object.assign(el.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      padding: "6px 12px",
      background: ink.base,
      color: ink.text,
      font: `600 12px ${font}`,
      borderRadius: `${radius.md}px`,
      boxShadow: shadow.chip,
      zIndex: "2147483647",
    })
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 12, 12)
    setTimeout(() => document.body.removeChild(el), 0)
  } catch {
    // best-effort polish only
  }
}
