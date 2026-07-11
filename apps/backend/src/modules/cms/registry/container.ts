import {
  isObj,
  isStr,
  ok,
  type BlockDefinition,
} from "./types"

/**
 * container — free-form column layout composed of ATOMIC WIDGETS (W1 composer).
 *
 * RESOLVED data shape (en lives on `section.data`; container has NO per-locale
 * translatable fields in v1 — no translation overrides):
 *
 *   {
 *     layout: "1" | "2" | "3" | "4"          // column count as string
 *     gap?: { value: number; unit: string }   // column gap (optional)
 *     verticalAlign?: "top"|"center"|"bottom" // column alignment (optional)
 *     columns: Array<{ widgets: Widget[] }>   // one entry per column
 *   }
 *
 * Widget = { widget_type: string, style?, advanced?, ...contentProps }. The
 * widget vocabulary (heading/text/image/button/spacer/divider/video/icon/html)
 * is OWNED by the storefront (schema/widgets.ts) — the backend is intentionally
 * PERMISSIVE about widget objects (any object with a string `widget_type`
 * passes; all other keys are passthrough) so new widget types never require a
 * backend deploy. The storefront renderer sanitizes/validates widget content
 * (html sanitization, video host whitelist) at render time.
 */

export const CONTAINER_LAYOUTS = ["1", "2", "3", "4"] as const
export type ContainerLayout = (typeof CONTAINER_LAYOUTS)[number]

export const CONTAINER_VERTICAL_ALIGNS = ["top", "center", "bottom"] as const
export type ContainerVerticalAlign =
  (typeof CONTAINER_VERTICAL_ALIGNS)[number]

export interface ContainerWidget {
  widget_type: string
  [key: string]: unknown
}

export interface ContainerColumn {
  widgets: ContainerWidget[]
}

export interface ContainerData {
  layout: ContainerLayout
  gap?: { value: number; unit: string }
  verticalAlign?: ContainerVerticalAlign
  columns: ContainerColumn[]
}

export const CONTAINER_SCHEMA_VERSION = 1

export const containerBlock: BlockDefinition<ContainerData> = {
  type: "container",
  label: "Container / Columns",
  schemaVersion: CONTAINER_SCHEMA_VERSION,
  defaultData: (): ContainerData => ({
    layout: "2",
    columns: [{ widgets: [] }, { widgets: [] }],
  }),
  validate: (data: unknown) => {
    const errors: string[] = []
    if (!isObj(data)) {
      return ok(["container: data must be an object"])
    }

    if (
      !isStr(data.layout) ||
      !(CONTAINER_LAYOUTS as readonly string[]).includes(data.layout)
    ) {
      errors.push(
        `container: layout must be one of ${CONTAINER_LAYOUTS.join(", ")}`
      )
    }

    if (
      data.verticalAlign !== undefined &&
      (!isStr(data.verticalAlign) ||
        !(CONTAINER_VERTICAL_ALIGNS as readonly string[]).includes(
          data.verticalAlign
        ))
    ) {
      errors.push(
        `container: verticalAlign must be one of ${CONTAINER_VERTICAL_ALIGNS.join(
          ", "
        )}`
      )
    }

    if (data.gap !== undefined && !isObj(data.gap)) {
      errors.push("container: gap must be an object ({ value, unit })")
    }

    if (!Array.isArray(data.columns)) {
      errors.push("container: columns must be an array")
      return ok(errors)
    }

    data.columns.forEach((col, c) => {
      if (!isObj(col)) {
        errors.push(`container: columns[${c}] must be an object`)
        return
      }
      if (!Array.isArray(col.widgets)) {
        errors.push(`container: columns[${c}].widgets must be an array`)
        return
      }
      // PERMISSIVE widget validation: any object with a string widget_type
      // passes; content/style keys are passthrough (storefront-owned).
      col.widgets.forEach((w, i) => {
        if (!isObj(w)) {
          errors.push(`container: columns[${c}].widgets[${i}] must be an object`)
          return
        }
        if (!isStr(w.widget_type) || w.widget_type.length === 0) {
          errors.push(
            `container: columns[${c}].widgets[${i}].widget_type is required (string)`
          )
        }
      })
    })

    return ok(errors)
  },
}

export default containerBlock
