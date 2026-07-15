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
  const isOverride = overridden && device !== "desktop"

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
