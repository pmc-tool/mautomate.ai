import type { BlockSchema } from "../types"

/* ------------------------------------------------------------------ */
/* Container / Columns — arbitrary layout composition (Composer W1)     */
/*                                                                     */
/* The one block whose data is COMPOSED rather than fixed: it holds      */
/* `columns: Array<{ widgets: Widget[] }>` where each widget is           */
/* { widget_type, style?, advanced?, ...contentProps } (see               */
/* schema/widgets.ts for the widget registry). One level of nesting —     */
/* widgets cannot contain containers.                                     */
/*                                                                       */
/* `columns` is deliberately NOT a schema field: the editor renders a     */
/* dedicated column/widget UI for it instead of a generic control, and    */
/* validatePropsFromSchema only checks declared fields (extra props pass   */
/* through untouched, exactly like `style` / `advanced` / `elementStyles`).*/
/* The `layout` count and `columns.length` may disagree mid-edit — the     */
/* renderer must tolerate the mismatch and render what exists.             */
/* ------------------------------------------------------------------ */

export const containerSchema: BlockSchema = {
  type: "container",
  label: "Container / Columns",
  category: "layout",
  icon: "Columns3",
  fields: [
    {
      name: "layout",
      type: "choose",
      label: "Columns",
      default: "2",
      group: "Layout",
      help: "Number of columns. Existing widgets are kept when you change it.",
      options: [
        { label: "1", value: "1", icon: "Square" },
        { label: "2", value: "2", icon: "Columns2" },
        { label: "3", value: "3", icon: "Columns3" },
        { label: "4", value: "4", icon: "Columns4" },
      ],
    },
    {
      name: "gap",
      type: "unitNumber",
      label: "Column gap",
      group: "Layout",
      units: ["px", "rem", "em"],
      min: 0,
      max: 200,
      step: 1,
      help: "Space between columns.",
    },
    {
      name: "verticalAlign",
      type: "choose",
      label: "Vertical align",
      default: "top",
      group: "Layout",
      help: "How columns of different heights line up.",
      options: [
        { label: "Top", value: "top", icon: "AlignStartHorizontal" },
        { label: "Center", value: "center", icon: "AlignCenterHorizontal" },
        { label: "Bottom", value: "bottom", icon: "AlignEndHorizontal" },
      ],
    },
  ],
  defaultProps: {
    layout: "2",
    columns: [{ widgets: [] }, { widgets: [] }],
  },
}

export default containerSchema
