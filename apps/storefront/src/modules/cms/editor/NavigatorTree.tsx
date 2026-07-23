"use client"

/* ------------------------------------------------------------------ */
/* NavigatorTree — Elementor's Navigator, as a real tree.               */
/*                                                                     */
/* The panel's Navigator tab used to be a FLAT list: one row per        */
/* section, full stop. That was honest when a page was a stack of       */
/* commerce blocks, but a container section now holds columns, and a    */
/* column holds widgets, and an `inner_section` widget holds columns of */
/* its own. None of that structure was reachable from the panel — the   */
/* only way to select a widget was to find it on the canvas.            */
/*                                                                     */
/* So the Navigator is now what Elementor's is: an expandable outline   */
/* of the whole page.                                                   */
/*                                                                     */
/*   Section                (level 1, draggable to reorder)             */
/*     Column 1             (level 2, containers only)                  */
/*       Heading            (level 3 — a widget)                        */
/*       Inner Section      (level 3, expandable)                       */
/*         Column 1         (level 4)                                   */
/*           Button         (level 5)                                   */
/*                                                                     */
/* Clicking ANY row selects that thing, which swaps the panel to its    */
/* settings form and mirrors the selection into the canvas through the  */
/* existing cms:select / cms:selectWidget messages. Nothing about the   */
/* section drag-reorder changed: the shell still owns those closures    */
/* (dragIndexRef / moveSectionTo) and hands them in per row.            */
/*                                                                     */
/* PATH MATH — the one thing that has to be exactly right. A widget is  */
/* addressed by `[...colPath, wi]`, where colPath has ODD length (see   */
/* widgetsAtPath in the shell): [c] for a top-level column, and         */
/* [c, wi, c2] for a column of the inner section at [c, wi]. This tree  */
/* builds paths by that same alternation, so a row's path is literally  */
/* the argument selectWidget() expects.                                 */
/* ------------------------------------------------------------------ */

import React, { useEffect, useMemo, useState } from "react"
import { getWidgetSchema } from "@modules/cms/schema/widgets"
import { facadeOf } from "@modules/cms/document/facade"
/* 3A: widget rows are drag SOURCES for the canvas (navigator→canvas
   move). One codec — the same wire the canvas widget grip speaks. */
import { startWidgetMoveDrag } from "./canvas/dnd"
import { setCardDragImage } from "./drag-ghost"
import { PaletteIcon, UiIcon } from "./palette-icons"
import {
  accent,
  font,
  grey,
  motion,
  radius,
  type,
} from "@modules/cms/editor/design"

/* ----------------------------- shapes ----------------------------- */

/** Page content is loosely typed everywhere in the editor; the tree only
 *  ever READS it, so it narrows defensively rather than demanding a type. */
export type NavSection = { block_type: string; [k: string]: unknown }

type Widgetish = {
  widget_type?: unknown
  columns?: unknown
  [k: string]: unknown
}
type Columnish = { widgets?: unknown; [k: string]: unknown }

const asColumns = (v: unknown): Columnish[] =>
  Array.isArray(v) ? (v as Columnish[]) : []

const asWidgets = (v: unknown): Widgetish[] =>
  Array.isArray(v) ? (v as Widgetish[]) : []

/** Columns of a section — null when the section is not a container, which is
 *  every legacy commerce block and therefore most rows on most live pages. */
function sectionColumns(s: NavSection): Columnish[] | null {
  if (s.block_type !== "container") {
    return null
  }
  return asColumns((s as Widgetish).columns)
}

/** Columns of an inner-section widget — null for every other widget type. */
function innerColumns(w: Widgetish): Columnish[] | null {
  if (w.widget_type !== "inner_section") {
    return null
  }
  return asColumns(w.columns)
}

function widgetType(w: Widgetish): string {
  return typeof w.widget_type === "string" ? w.widget_type : ""
}

function widgetLabel(w: Widgetish): string {
  const t = widgetType(w)
  return getWidgetSchema(t)?.label ?? (t || "Widget")
}

/* -------------------------- expansion keys -------------------------- */
/* Keys are derived from POSITION, not identity, because that is all the
   content array gives us. A reorder therefore keeps the shape of the tree
   rather than the identity of a branch — the same trade Elementor makes. */

const sectionKey = (i: number) => `S:${i}`
const columnKey = (i: number, colPath: number[]) =>
  `C:${i}:${colPath.join("-")}`
const widgetKey = (i: number, path: number[]) => `W:${i}:${path.join("-")}`

/**
 * Every expandable ancestor of a widget at (index, path), so the tree can
 * open the branch a selection lives in. Odd-length prefixes are column
 * paths, even-length prefixes are inner-section widgets.
 */
function ancestorKeys(index: number, path: number[]): string[] {
  const keys = [sectionKey(index)]
  for (let k = 1; k < path.length; k++) {
    const prefix = path.slice(0, k)
    keys.push(k % 2 === 1 ? columnKey(index, prefix) : widgetKey(index, prefix))
  }
  return keys
}

/* ------------------------------ a row ------------------------------ */

type DragHandler = (e: React.DragEvent<HTMLDivElement>) => void

function TreeRow({
  depth,
  icon,
  label,
  selected,
  muted,
  dragOver,
  expandable,
  expanded,
  onToggle,
  onClick,
  trailing,
  title,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  depth: number
  icon?: React.ReactNode
  label: string
  selected?: boolean
  muted?: boolean
  dragOver?: boolean
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  onClick?: () => void
  trailing?: React.ReactNode
  title?: string
  draggable?: boolean
  onDragStart?: DragHandler
  onDragOver?: DragHandler
  onDrop?: DragHandler
  onDragEnd?: DragHandler
}) {
  const [hover, setHover] = useState(false)
  const interactive = !!onClick

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-expanded={expandable ? !!expanded : undefined}
      aria-current={selected ? "true" : undefined}
      title={title}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!interactive) {
          return
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick?.()
        }
        if (expandable && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
          e.preventDefault()
          onToggle?.()
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...type.body,
        fontFamily: font,
        display: "flex",
        alignItems: "center",
        gap: 6,
        width: "100%",
        textAlign: "left",
        boxSizing: "border-box",
        // Indentation is padding, not margin, so the hover/selected fill
        // still spans the full panel width like Elementor's does.
        padding: `5px 8px 5px ${8 + depth * 13}px`,
        margin: "1px 0",
        border: `1px solid ${
          dragOver ? accent.base : selected ? accent.tintStrong : "transparent"
        }`,
        borderRadius: radius.sm,
        background: dragOver
          ? accent.tint
          : selected
          ? accent.tint
          : hover && interactive
          ? grey[5]
          : "transparent",
        color: selected ? accent.base : muted ? grey[40] : grey[90],
        cursor: draggable ? "grab" : interactive ? "pointer" : "default",
        userSelect: "none",
        transition: `background ${motion.fast}, border-color ${motion.fast}, color ${motion.fast}`,
      }}
    >
      {/* Disclosure triangle — a sibling, never a nested <button>, so the
          whole row can stay one clickable element. */}
      <span
        aria-hidden
        onClick={
          expandable
            ? (e) => {
                e.stopPropagation()
                onToggle?.()
              }
            : undefined
        }
        style={{
          width: 12,
          height: 12,
          flexShrink: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: grey[40],
          cursor: expandable ? "pointer" : "default",
          transform: expanded ? "none" : "rotate(-90deg)",
          transition: `transform ${motion.fast}`,
        }}
      >
        {expandable ? <UiIcon name="chevron-down" size={12} /> : null}
      </span>

      {icon ? (
        <span
          aria-hidden
          style={{
            color: selected ? accent.base : muted ? grey[30] : grey[50],
            display: "inline-flex",
            flexShrink: 0,
            transition: `color ${motion.fast}`,
          }}
        >
          {icon}
        </span>
      ) : null}

      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
          flex: 1,
        }}
      >
        {label}
      </span>

      {trailing ? (
        <span
          aria-hidden
          style={{
            ...type.label,
            color: grey[40],
            flexShrink: 0,
          }}
        >
          {trailing}
        </span>
      ) : null}
    </div>
  )
}

/* ------------------------------- tree ------------------------------- */

export default function NavigatorTree({
  content,
  selectedSection,
  selectedWidget,
  selectedColumn,
  sectionLabel,
  onSelectSection,
  onSelectWidget,
  onSelectColumn,
  dragOverIndex,
  onSectionDragStart,
  onSectionDragOver,
  onSectionDrop,
  onSectionDragEnd,
}: {
  content: NavSection[]
  /** index of the selected SECTION, or null when a widget/nothing is selected */
  selectedSection: number | null
  /** the selected widget, addressed exactly as selectWidget() expects */
  selectedWidget: { index: number; path: number[] } | null
  /** the selected COLUMN (Phase 2B), or null. Optional so existing mounts
   *  compile unchanged until the shell wires column selection in. */
  selectedColumn?: { index: number; colPath: number[] } | null
  /** human label for a block_type (the shell owns BLOCK_LABELS) */
  sectionLabel: (blockType: string) => string
  onSelectSection: (index: number) => void
  onSelectWidget: (index: number, path: number[]) => void
  /** Select a column (Phase 2B — the owner's ask). When absent, a column
   *  row's click keeps its old expand/collapse-only behavior. This is the
   *  one road onto a FACADE's implicit column (the canvas has no
   *  [data-col] to click there), where the panel styles the section box
   *  (INTEGRATION-2E §4). */
  onSelectColumn?: (index: number, colPath: number[]) => void
  dragOverIndex: number | null
  onSectionDragStart: (index: number) => DragHandler
  onSectionDragOver: (index: number) => DragHandler
  onSectionDrop: (index: number) => DragHandler
  onSectionDragEnd: (index: number) => DragHandler
}) {
  // Expansion persists for the whole editing session — collapsing a section
  // you are done with must survive the next edit, or the tree resets itself
  // under the merchant every time content streams back.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })

  // Auto-open the branch the selection lives in, so the tree follows the
  // canvas: click a widget on the page and the Navigator reveals it.
  const openKeys = useMemo(
    () =>
      selectedWidget
        ? ancestorKeys(selectedWidget.index, selectedWidget.path)
        : selectedColumn
        ? // A column's ancestors are a widget-path's ancestors plus itself
          // (ancestorKeys treats the odd-length prefix as the column key).
          [
            ...ancestorKeys(selectedColumn.index, selectedColumn.colPath),
            columnKey(selectedColumn.index, selectedColumn.colPath),
          ]
        : selectedSection != null
        ? [sectionKey(selectedSection)]
        : [],
    [selectedWidget, selectedColumn, selectedSection]
  )
  const openSignature = openKeys.join("|")

  useEffect(() => {
    if (!openKeys.length) {
      return
    }
    setExpanded((prev) => {
      if (openKeys.every((k) => prev.has(k))) {
        return prev
      }
      const next = new Set(prev)
      openKeys.forEach((k) => next.add(k))
      return next
    })
    // openSignature is the value identity of openKeys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignature])

  const isSelectedWidget = (index: number, path: number[]) =>
    !!selectedWidget &&
    selectedWidget.index === index &&
    selectedWidget.path.length === path.length &&
    selectedWidget.path.every((v, i) => v === path[i])

  const isSelectedColumn = (index: number, colPath: number[]) =>
    !!selectedColumn &&
    selectedColumn.index === index &&
    selectedColumn.colPath.length === colPath.length &&
    selectedColumn.colPath.every((v, i) => v === colPath[i])

  /** Widgets of one column, plus any inner-section subtree. */
  const renderWidgets = (
    index: number,
    colPath: number[],
    widgets: Widgetish[],
    depth: number
  ): React.ReactNode => {
    if (!widgets.length) {
      return (
        <TreeRow
          key={`${columnKey(index, colPath)}:empty`}
          depth={depth}
          label="No widgets yet"
          muted
        />
      )
    }
    return widgets.map((w, wi) => {
      const path = [...colPath, wi]
      const inner = innerColumns(w)
      const key = widgetKey(index, path)
      const open = expanded.has(key)
      return (
        <React.Fragment key={key}>
          <TreeRow
            depth={depth}
            icon={<PaletteIcon type={widgetType(w)} size={15} />}
            label={widgetLabel(w)}
            selected={isSelectedWidget(index, path)}
            expandable={!!inner}
            expanded={open}
            onToggle={() => toggle(key)}
            onClick={() => onSelectWidget(index, path)}
            title="Click to edit, or drag onto the page to move this widget"
            /* 3A: drag a widget row onto the canvas — same move payload
               as the on-canvas grip; the canvas resolver routes it to
               widget.move (same column) or widget.transfer (anywhere
               else, incl. into a facade). stopPropagation so no
               ancestor drag handler re-decorates the payload. */
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              startWidgetMoveDrag(e.dataTransfer, {
                index,
                colPath,
                wi,
              })
              setCardDragImage(e, widgetLabel(w))
            }}
          />
          {inner && open ? renderColumns(index, path, inner, depth + 1) : null}
        </React.Fragment>
      )
    })
  }

  /** A list of columns. `prefix` is the path TO those columns: [] for a
   *  container section, [c, wi] for an inner section's own columns. */
  const renderColumns = (
    index: number,
    prefix: number[],
    cols: Columnish[],
    depth: number
  ): React.ReactNode =>
    cols.map((col, ci) => {
      const colPath = [...prefix, ci]
      const key = columnKey(index, colPath)
      const open = expanded.has(key)
      const widgets = asWidgets(col.widgets)
      return (
        <React.Fragment key={key}>
          <TreeRow
            depth={depth}
            icon={<UiIcon name="columns" size={14} />}
            label={`Column ${ci + 1}`}
            selected={isSelectedColumn(index, colPath)}
            expandable
            expanded={open}
            onToggle={() => toggle(key)}
            // Phase 2B (the owner's ask): clicking a column row SELECTS the
            // column — and reveals its widgets, so the click never feels
            // like it swallowed the old expand behavior. Without a column
            // handler wired in, the row keeps its expand/collapse-only
            // click exactly as before.
            onClick={
              onSelectColumn
                ? () => {
                    onSelectColumn(index, colPath)
                    if (!open) {
                      toggle(key)
                    }
                  }
                : () => toggle(key)
            }
            trailing={widgets.length ? String(widgets.length) : "0"}
            title={
              onSelectColumn
                ? "Click to style this column"
                : widgets.length === 1
                ? "1 widget"
                : `${widgets.length} widgets`
            }
          />
          {open ? renderWidgets(index, colPath, widgets, depth + 1) : null}
        </React.Fragment>
      )
    })

  if (!content.length) {
    return (
      <p style={{ ...type.body, color: grey[50], marginTop: 0 }}>
        This page is empty. Add a section to get started.
      </p>
    )
  }

  return (
    <div>
      {content.map((b, i) => {
        const cols = sectionColumns(b)
        const key = sectionKey(i)
        const open = expanded.has(key)
        const count = cols
          ? cols.reduce((n, c) => n + asWidgets(c.widgets).length, 0)
          : 0
        // Facade wrapper (Phase 1 normalization): a flush single-commerce-
        // widget container presents as its INNER block — "Hero Slider", hero
        // icon — not "Container / Columns". Structure is NOT hidden: the row
        // stays expandable, and expanding it shows Column 1 → the widget,
        // exactly like any container. Multi-widget/multi-column containers
        // keep full container presentation (isFacade false).
        const facade = facadeOf(b)
        return (
          <React.Fragment key={key}>
            <TreeRow
              depth={0}
              icon={
                <PaletteIcon
                  type={facade.isFacade ? facade.iconType : b.block_type}
                  size={16}
                />
              }
              label={
                facade.isFacade ? facade.label : sectionLabel(b.block_type)
              }
              selected={selectedSection === i}
              dragOver={dragOverIndex === i}
              expandable={!!cols}
              expanded={open}
              onToggle={() => toggle(key)}
              onClick={() => onSelectSection(i)}
              title="Drag to reorder, or click to edit"
              draggable
              onDragStart={onSectionDragStart(i)}
              onDragOver={onSectionDragOver(i)}
              onDrop={onSectionDrop(i)}
              onDragEnd={onSectionDragEnd(i)}
              trailing={
                // A facade row reads like the flat block it wraps (its
                // position number), not like container bookkeeping.
                facade.isFacade
                  ? String(i + 1)
                  : cols
                  ? `${cols.length} col${cols.length > 1 ? "s" : ""}${
                      count ? ` · ${count}` : ""
                    }`
                  : String(i + 1)
              }
            />
            {cols && open ? renderColumns(i, [], cols, 1) : null}
          </React.Fragment>
        )
      })}
    </div>
  )
}
