import type { BlockSchema } from "../types"

export const productTabsSchema: BlockSchema = {
  type: "product_tabs",
  label: "Product Tabs",
  category: "products",
  icon: "LayoutGrid",
  fields: [
    {
      name: "tabs",
      type: "list",
      label: "Tabs",
      itemLabel: "Tab",
      maxItems: 3,
      help: "Only the first 3 tabs render on the storefront.",
      fields: [
        {
          name: "label",
          type: "text",
          label: "Tab label",
          required: true,
          default: "New arrivals",
          group: "Content",
        },
        {
          name: "source",
          type: "select",
          label: "Product source",
          default: "all",
          group: "Source",
          options: [
            { label: "All products", value: "all" },
            { label: "Category", value: "category" },
            { label: "Collection", value: "collection" },
            { label: "Manual (hand-picked)", value: "manual" },
          ],
        },
        {
          name: "category_id",
          type: "collection",
          label: "Category ID",
          default: "",
          group: "Source",
          help: "Required when source is Category. A product picker comes later.",
          hidden: (props) => props.source !== "category",
        },
        {
          name: "collection_id",
          type: "text",
          label: "Collection ID",
          default: "",
          group: "Source",
          help: "Required when source is Collection. A collection picker comes later.",
          hidden: (props) => props.source !== "collection",
        },
        {
          name: "sort",
          type: "select",
          label: "Sort by",
          default: "created_at",
          group: "Behavior",
          options: [
            { label: "Newest", value: "created_at" },
            { label: "Price: low to high", value: "price_asc" },
            { label: "Price: high to low", value: "price_desc" },
          ],
        },
        {
          name: "limit",
          type: "number",
          label: "Max products",
          default: 10,
          min: 1,
          max: 50,
          step: 1,
          group: "Behavior",
        },
      ],
    },
  ],
  defaultProps: {
    tabs: [
      {
        label: "New arrivals",
        source: "all",
        sort: "created_at",
        limit: 10,
      },
      {
        label: "Sale items",
        source: "all",
        sort: "created_at",
        limit: 10,
      },
      {
        label: "Best sellers",
        source: "all",
        sort: "price_desc",
        limit: 10,
      },
    ],
  },
  presets: [
    {
      name: "Single tab — latest products",
      props: {
        tabs: [
          {
            label: "New arrivals",
            source: "all",
            sort: "created_at",
            limit: 10,
          },
        ],
      },
    },
  ],
}

export default productTabsSchema
