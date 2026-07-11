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
      background: "#26292c",
      color: "#fff",
      font: "600 12px system-ui, sans-serif",
      borderRadius: "4px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      zIndex: "2147483647",
    })
    document.body.appendChild(el)
    e.dataTransfer.setDragImage(el, 12, 12)
    setTimeout(() => document.body.removeChild(el), 0)
  } catch {
    // best-effort polish only
  }
}
