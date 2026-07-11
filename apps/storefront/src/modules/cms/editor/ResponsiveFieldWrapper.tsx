"use client"

/* ------------------------------------------------------------------ */
/* ResponsiveFieldWrapper — make ANY control device-aware               */
/*                                                                     */
/* Wraps a single control (render-prop) so its value can differ per      */
/* device. It reads/writes ONLY the active device's slot of a            */
/* `ResponsiveValue<T>` ({ base, tablet?, mobile? }):                    */
/*   - editing "desktop"  writes `base`                                  */
/*   - editing "tablet"/"mobile" creates/updates that device override    */
/* Storage stays DIFF-ONLY: a plain (non-responsive) value is kept plain  */
/* until an override is added, and clearing the last override collapses    */
/* the shape back to a plain scalar.                                       */
/*                                                                        */
/* When the active device has NO override it shows the inherited          */
/* (resolved) value GHOSTED with a hint naming the source device, plus a   */
/* clear-override control whenever an override exists.                     */
/*                                                                        */
/* For fields where `field.responsive` is not true this is a pure          */
/* passthrough — it edits the plain value and renders no device chrome.    */
/* ------------------------------------------------------------------ */

import React from "react"
import type { Device, FieldDef, ResponsiveValue } from "@modules/cms/schema/types"
import { isResponsiveValue, resolveResponsive } from "@modules/cms/schema/types"

/* --------------------------- public API --------------------------- */
export interface ResponsiveFieldWrapperProps {
  /** The field being edited (only `responsive`/`label` are read here). */
  field: FieldDef
  /** Current stored value: a plain scalar OR a ResponsiveValue<T>. */
  value: unknown
  /** Which device the panel is currently editing. */
  device: Device
  /**
   * Commit a change to the STORED value. Receives either a plain value
   * (desktop edit with no other overrides / last override cleared) or a
   * full ResponsiveValue when tablet/mobile overrides exist.
   */
  onChange: (nextResponsiveOrPlain: unknown) => void
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
  margin: "0 0 5px",
}
const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "#2563eb",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  borderRadius: 5,
  padding: "2px 6px",
}
const inheritHint: React.CSSProperties = {
  fontSize: 10,
  fontStyle: "italic",
  color: "#9ca3af",
}
const clearBtn: React.CSSProperties = {
  marginLeft: "auto",
  border: "1px solid #fecaca",
  background: "#fff",
  color: "#b91c1c",
  borderRadius: 5,
  fontSize: 10,
  fontWeight: 600,
  padding: "2px 7px",
  cursor: "pointer",
}
const overriddenDot: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#2563eb",
  display: "inline-block",
}

const DEVICE_LABEL: Record<Device, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
}

/* --------------------------- helpers ------------------------------ */
/** The desktop / base value of a (possibly responsive) stored value. */
function baseOf(value: unknown): unknown {
  return isResponsiveValue(value) ? (value as ResponsiveValue<unknown>).base : value
}

/** Does the active device carry its own override? (desktop is always authoritative) */
function hasOverride(value: unknown, device: Device): boolean {
  if (device === "desktop") {
    return true
  }
  return isResponsiveValue(value) && (value as ResponsiveValue<unknown>)[device] !== undefined
}

/** Which device does an un-overridden `device` inherit its value from? */
function inheritsFrom(value: unknown, device: Device): Device | null {
  if (device === "tablet") {
    return "desktop"
  }
  if (device === "mobile") {
    const hasTablet =
      isResponsiveValue(value) && (value as ResponsiveValue<unknown>).tablet !== undefined
    return hasTablet ? "tablet" : "desktop"
  }
  return null
}

/* --------------------------- component ---------------------------- */
export default function ResponsiveFieldWrapper({
  field,
  value,
  device,
  onChange,
  children,
}: ResponsiveFieldWrapperProps) {
  /* Passthrough for non-responsive fields — edit the plain value directly. */
  if (!field.responsive) {
    return <>{children(value, onChange)}</>
  }

  const overridden = hasOverride(value, device)
  const resolved = resolveResponsive(value as never, device)

  /** Commit an edit for the active device slot. */
  const setDeviceValue = (v: unknown) => {
    if (device === "desktop") {
      // Keep any tablet/mobile overrides; otherwise store a plain value.
      if (isResponsiveValue(value)) {
        onChange({ ...(value as ResponsiveValue<unknown>), base: v })
      } else {
        onChange(v)
      }
      return
    }
    // tablet / mobile — ensure a ResponsiveValue shape, then set this slot.
    const rv: ResponsiveValue<unknown> = isResponsiveValue(value)
      ? { ...(value as ResponsiveValue<unknown>) }
      : { base: baseOf(value) }
    rv[device] = v
    onChange(rv)
  }

  /** Delete the active device override, collapsing to plain when it was the last. */
  const clearOverride = () => {
    if (device === "desktop" || !isResponsiveValue(value)) {
      return
    }
    const rv: ResponsiveValue<unknown> = { ...(value as ResponsiveValue<unknown>) }
    delete rv[device]
    if (rv.tablet === undefined && rv.mobile === undefined) {
      onChange(rv.base)
    } else {
      onChange(rv)
    }
  }

  const source = inheritsFrom(value, device)
  const showInherited = !overridden && device !== "desktop"

  return (
    <div>
      <div style={barRow}>
        <span style={badge}>
          {overridden && device !== "desktop" ? <span style={overriddenDot} /> : null}
          {DEVICE_LABEL[device]}
        </span>
        {showInherited && source ? (
          <span style={inheritHint}>inherits from {DEVICE_LABEL[source]}</span>
        ) : null}
        {overridden && device !== "desktop" ? (
          <button type="button" style={clearBtn} onClick={clearOverride} title="Remove this device override">
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
