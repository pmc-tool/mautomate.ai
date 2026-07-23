"use client"

/* ------------------------------------------------------------------ */
/* FacadeSectionSettings — the facade-form fix (Phase 2, 2C).           */
/*                                                                     */
/* P1-gate finding: clicking a facade section (normalizeDocument's      */
/* flush 1-column 1-commerce-widget wrapper) showed the CONTAINER form  */
/* first — the merchant clicked "Hero Slider" and got columns/gap, with */
/* the slider's fields one click deeper. ARCH-CORE's facade rule says   */
/* the wrapper must present as its inner block EVERYWHERE, and that     */
/* includes the panel: lead with the INNER block's own form, keep the   */
/* container's structure controls behind a quiet secondary door.        */
/*                                                                     */
/* Two views, one component:                                            */
/*   block     (default) — the inner widget's Content fields (its full  */
/*             block schema, groups and all) + Style / Advanced.        */
/*   container — the wrapper's structure form (columns picker, gap,     */
/*             ContainerColumnsEditor) + the same Style / Advanced.     */
/*                                                                     */
/* WRITE PATHS — load-bearing, do not "simplify":                       */
/*   - Content edits go to the INNER WIDGET at [0,0] via onWidgetChange */
/*     (the shell's writeWidget merge). Content-only writes keep the    */
/*     facade: the engine collapse rule ignores content.                */
/*   - Style / Advanced edits go to the SECTION WRAPPER's bags in BOTH  */
/*     views (onStyleChange / onAdvancedChange -> updateSelectedBag).   */
/*     Writing bags onto the inner widget instead would break the       */
/*     facade predicate (flushSingleCommerceWidget refuses widgets with */
/*     non-empty bags) AND change rendered output — the CSS scope       */
/*     `.cms-sec-sec-<i>` lives on the wrapper.                         */
/*   - Container structure edits go through onContainerChange (the      */
/*     shell's reconcileContainerProps + updateSelected lambda). A      */
/*     structural change may legitimately dissolve the facade (add a    */
/*     column -> it is a real container now); that is the derived-      */
/*     facade design working as intended.                               */
/*                                                                     */
/* The shell mounts this with a guard clause at the top of its          */
/* selectedBlock form IIFE — see INTEGRATION-2C.md.                     */
/* ------------------------------------------------------------------ */

import React, { useEffect, useState } from "react"
import SchemaPanel from "@modules/cms/editor/SchemaPanel"
import ContainerColumnsEditor, {
  type Column,
} from "@modules/cms/editor/ContainerColumnsEditor"
import { getBlockSchema, getWidgetSchema } from "@modules/cms/schema"
import type { Device } from "@modules/cms/schema/types"
import type { Tokens } from "@modules/cms/editor/style-controls"
import { UiIcon } from "@modules/cms/editor/palette-icons"
import type {
  SectionNode,
  WidgetNode,
} from "@modules/cms/document/normalize"
import {
  font,
  grey,
  hairline,
  motion,
  radius,
  type,
} from "@modules/cms/editor/design"

export default function FacadeSectionSettings({
  widget,
  container,
  onWidgetChange,
  onContainerChange,
  columns,
  onColumnsChange,
  onSelectWidget,
  styleBag,
  advancedBag,
  onStyleChange,
  onAdvancedChange,
  device,
  themeTokens,
}: {
  /** The facade's inner commerce widget (flushSingleCommerceWidget result). */
  widget: WidgetNode
  /** The wrapper section (block_type "container", flush, one column). */
  container: SectionNode
  /** Content patch for the inner widget — shell: writeWidget(i, [0,0], {...widget, ...next}). */
  onWidgetChange: (next: Record<string, unknown>) => void
  /** Container fields patch — shell: updateSelected(reconcileContainerProps(next)). */
  onContainerChange: (next: Record<string, unknown>) => void
  /** The wrapper's columns + the shell's existing column/widget wiring. */
  columns: Column[]
  onColumnsChange: (cols: Column[]) => void
  onSelectWidget: (col: number, wi: number) => void
  /** SECTION-level bags (the wrapper's) — shared by both views. */
  styleBag: Record<string, unknown>
  advancedBag: Record<string, unknown>
  onStyleChange: (next: Record<string, unknown>) => void
  onAdvancedChange: (next: Record<string, unknown>) => void
  device?: Device
  themeTokens?: Tokens
}) {
  const widgetType = String(widget.widget_type)
  const blockSchema = getBlockSchema(widgetType)
  const blockLabel = getWidgetSchema(widgetType)?.label ?? widgetType
  // No registered schema for the inner type (future/unknown block): the only
  // useful form is the container's, so open on it instead of a dead pane.
  const [view, setView] = useState<"block" | "container">(
    blockSchema ? "block" : "container"
  )
  // Selecting a DIFFERENT facade section must not keep the previous door.
  useEffect(() => {
    setView(blockSchema ? "block" : "container")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetType, blockSchema ? 1 : 0])

  const [doorHover, setDoorHover] = useState(false)

  const sharedBagProps = {
    styleBag,
    advancedBag,
    onStyleChange,
    onAdvancedChange,
    device,
    themeTokens,
  }

  if (view === "container") {
    const { block_type, schema_version, ...containerData } =
      container as Record<string, unknown>
    return (
      <div style={{ fontFamily: font }}>
        {blockSchema && (
          <button
            onClick={() => setView("block")}
            style={{
              ...type.label,
              fontFamily: font,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: 0,
              background: "none",
              color: grey[50],
              cursor: "pointer",
              padding: "2px 0",
              marginBottom: 6,
            }}
          >
            <UiIcon name="arrow-left" size={12} />
            {blockLabel} settings
          </button>
        )}
        <SchemaPanel
          schema={getBlockSchema("container")!}
          props={containerData}
          onChange={onContainerChange}
          contentExtra={
            <ContainerColumnsEditor
              columns={columns}
              onChange={onColumnsChange}
              onSelectWidget={onSelectWidget}
            />
          }
          {...sharedBagProps}
        />
      </div>
    )
  }

  const {
    widget_type: _wt,
    style: _ws,
    advanced: _wa,
    elementStyles: _wes,
    schema_version: _wsv,
    ...contentProps
  } = widget as Record<string, unknown>

  return (
    <div style={{ fontFamily: font }}>
      {/* The quiet secondary door: structure lives one deliberate step away.
          Ghost row, hairline border — reads as a utility, not a sibling of
          the block's own fields. */}
      <button
        onClick={() => setView("container")}
        onMouseEnter={() => setDoorHover(true)}
        onMouseLeave={() => setDoorHover(false)}
        title="Layout of the section wrapper: columns, gap, width"
        style={{
          ...type.label,
          fontFamily: font,
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 28,
          padding: "0 8px",
          marginBottom: 10,
          border: hairline,
          borderRadius: radius.md,
          background: doorHover ? grey[5] : "transparent",
          color: doorHover ? grey[70] : grey[50],
          cursor: "pointer",
          transition: `background ${motion.fast}, color ${motion.fast}`,
        }}
      >
        <UiIcon name="columns" size={13} />
        Container settings
        <span
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            transform: "rotate(-90deg)",
          }}
        >
          <UiIcon name="chevron-down" size={13} />
        </span>
      </button>

      <SchemaPanel
        schema={blockSchema!}
        props={contentProps}
        onChange={onWidgetChange}
        {...sharedBagProps}
      />
    </div>
  )
}
