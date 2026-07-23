"use client"

/* ------------------------------------------------------------------ */
/* ResponsiveFieldWrapper — make ANY control device-aware               */
/*                                                                     */
/* Wraps a single control (render-prop) so its value can differ per      */
/* device. 3C (ARCH-CANVAS P7): the wrapper no longer computes shapes    */
/* itself — every edit routes through `writeResponsive` and every        */
/* override removal through `clearResponsiveOverride`                    */
/* (schema/types.ts), THE single device-write path:                      */
/*   - editing "desktop"  writes `base` (kept PLAIN until an override    */
/*     exists — untouched fields never change shape)                     */
/*   - editing "tablet"/"mobile" PROMOTES a plain value to               */
/*     `{ base, tablet?, mobile? }` on the first override                */
/*   - clearing the last override DEMOTES back to the plain value        */
/* Storage stays DIFF-ONLY throughout (empty plain values delete the     */
/* bag key), so promote → clear round-trips byte-identically.            */
/*                                                                      */
/* When the active device has NO override it shows the inherited         */
/* (resolved) value GHOSTED with a hint naming the source device; when   */
/* an override EXISTS the device pill carries the ember override dot     */
/* (Elementor's per-device indicator) plus a "Reset <device>" control.   */
/*                                                                      */
/* For fields where `field.responsive` is not true this is a plain-value */
/* passthrough (still routed through writeResponsive's desktop path so   */
/* the diff-only delete-on-empty rule lives in exactly one place).       */
/* ------------------------------------------------------------------ */

import React from "react"
import type { Device, FieldDef } from "@modules/cms/schema/types"
import {
  clearResponsiveOverride,
  hasDeviceOverride,
  resolveResponsive,
  writeResponsive,
} from "@modules/cms/schema/types"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import {
  accent,
  button,
  font,
  grey,
  motion,
  radius,
  type,
} from "@modules/cms/editor/design"

/* --------------------------- public API --------------------------- */
export interface ResponsiveFieldWrapperProps {
  /** The field being edited (`responsive`/`name`/`label` are read here). */
  field: FieldDef
  /** The WHOLE diff-only bag this field lives in (style or advanced). */
  bag: Record<string, unknown>
  /** Which device the panel is currently editing. */
  device: Device
  /**
   * Commit the NEXT bag. The wrapper derives it via writeResponsive /
   * clearResponsiveOverride, so callers never see (or build) device shapes.
   */
  onBagChange: (nextBag: Record<string, unknown>) => void
  /**
   * Render-prop for the wrapped control.
   * @param deviceValue    the RESOLVED value for the active device (shows the
   *                        inherited value even when there is no override).
   * @param setDeviceValue commit an edit for the active device slot.
   */
  children: (deviceValue: unknown, setDeviceValue: (v: unknown) => void) => React.ReactNode
}

/* ----------------------------- styles ----------------------------- */
const barRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  margin: "0 0 6px",
}
/** The device pill: neutral when inherited, ember when this device is overridden. */
const badge = (on: boolean): React.CSSProperties => ({
  ...type.micro,
  fontFamily: font,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  height: 20,
  padding: "0 6px",
  borderRadius: radius.sm,
  color: on ? accent.base : grey[60],
  background: on ? accent.tint : grey[10],
  border: `1px solid ${on ? accent.base : grey[20]}`,
  transition: motion.fast,
})
const inheritHint: React.CSSProperties = {
  ...type.micro,
  fontFamily: font,
  textTransform: "none",
  letterSpacing: 0,
  fontWeight: 400,
  fontStyle: "italic",
  color: grey[40],
}
const clearBtn: React.CSSProperties = {
  ...button("danger", "sm"),
  ...type.micro,
  fontFamily: font,
  marginLeft: "auto",
  height: 20,
  padding: "0 8px",
}
const overriddenDot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: radius.pill,
  background: accent.base,
  display: "inline-block",
}

const DEVICE_LABEL: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
}

const DEVICE_ICON: Record<Device, string> = {
  desktop: "monitor",
  tablet: "tablet",
  mobile: "phone",
}

/* --------------------------- helpers ------------------------------ */
/** Which device does an un-overridden `device` inherit its value from? */
function inheritsFrom(value: unknown, device: Device): Device | null {
  if (device === "tablet") {
    return "desktop"
  }
  if (device === "mobile") {
    return hasDeviceOverride(value, "tablet") ? "tablet" : "desktop"
  }
  return null
}

/* --------------------------- component ---------------------------- */
export default function ResponsiveFieldWrapper({
  field,
  bag,
  device,
  onBagChange,
  children,
}: ResponsiveFieldWrapperProps) {
  const value = bag[field.name]

  /* Passthrough for non-responsive fields — one plain value for every device,
     written through writeResponsive's desktop path so the diff-only
     delete-on-empty rule lives in exactly one place. */
  if (!field.responsive) {
    return (
      <>
        {children(value, (v) =>
          onBagChange(writeResponsive(bag, field.name, "desktop", v))
        )}
      </>
    )
  }

  // Desktop edits the base directly (authoritative, never an "override");
  // hasDeviceOverride is false for desktop by definition.
  const isOverride = hasDeviceOverride(value, device)
  const overridden = device === "desktop" || isOverride
  const resolved = resolveResponsive(value as never, device)

  /** Commit an edit for the active device slot — THE single write path. */
  const setDeviceValue = (v: unknown) => {
    onBagChange(writeResponsive(bag, field.name, device, v))
  }

  /** Delete the active device override, demoting to plain when it was the last. */
  const clearOverride = () => {
    onBagChange(clearResponsiveOverride(bag, field.name, device))
  }

  const source = inheritsFrom(value, device)
  // Un-overridden tablet/mobile shows the inherited value ghosted; !overridden
  // already implies a non-desktop device (desktop is always authoritative).
  const showInherited = !overridden

  return (
    <div>
      <div style={barRow}>
        <span style={badge(isOverride)}>
          <UiIcon name={DEVICE_ICON[device]} size={12} />
          {isOverride ? <span style={overriddenDot} /> : null}
          {DEVICE_LABEL[device]}
        </span>
        {showInherited && source ? (
          <span style={inheritHint}>inherits from {DEVICE_LABEL[source]}</span>
        ) : null}
        {isOverride ? (
          <button type="button" style={clearBtn} onClick={clearOverride} title="Remove this device override">
            <UiIcon name="reset" size={12} />
            Reset {DEVICE_LABEL[device]}
          </button>
        ) : null}
      </div>
      <div style={showInherited ? { opacity: 0.55 } : undefined}>
        {children(resolved, setDeviceValue)}
      </div>
    </div>
  )
}
