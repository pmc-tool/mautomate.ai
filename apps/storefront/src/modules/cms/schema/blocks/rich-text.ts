import type { BlockSchema } from "../types"

export const richTextSchema: BlockSchema = {
  type: "rich_text",
  label: "Rich Text",
  category: "content",
  icon: "Type",
  fields: [
    {
      name: "html",
      type: "richText",
      label: "Content",
      required: true,
      help: "Headings, paragraphs, lists, links and emphasis. Scripts and inline event handlers are stripped on render.",
      group: "Content",
    },
    {
      name: "width",
      type: "select",
      label: "Container width",
      default: "normal",
      help: "Locale-invariant layout width for the reading column.",
      group: "Layout",
      options: [
        { label: "Narrow", value: "narrow" },
        { label: "Normal", value: "normal" },
        { label: "Wide", value: "wide" },
        { label: "Full", value: "full" },
      ],
    },
  ],
  defaultProps: {
    html:
      "<h2>Our Story</h2>\n" +
      "<p>Forever Finds is an online shop for handicrafts and arts' works. We craft beautiful pieces by hand, pairing useful tools with creativity to bring you unique vases, wall art, home accessories and furniture.</p>\n" +
      '<p>Have a question? <a href="/contact">Get in touch</a> — we would love to hear from you.</p>',
    width: "normal",
  },
  presets: [
    {
      name: "Narrow reading column",
      props: {
        html:
          "<h2>Edit this heading</h2>\n<p>Type your content here…</p>",
        width: "narrow",
      },
    },
  ],
}

export default richTextSchema
