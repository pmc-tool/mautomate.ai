import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, AdminProduct } from "@medusajs/types"
import { Container, Heading, Text, Button } from "@medusajs/ui"
import { Sparkles, Photo, Camera } from "@medusajs/icons"

/**
 * "Promote" widget on the product detail page.
 *
 * A compact card giving one-click jumps into the marketing tools, pre-scoped to
 * the product being viewed via a `product_id` query param the target routes
 * read. Purely navigational + self-contained: renders nothing when there is no
 * product id, so it can never break the product detail screen.
 */
const MarketingPromoteWidget = ({
  data,
}: DetailWidgetProps<AdminProduct>) => {
  const productId = data?.id
  if (!productId) {
    return null
  }

  const actions = [
    {
      label: "Compose a post",
      href: `/app/marketing/compose?product_id=${productId}`,
      Icon: Sparkles,
    },
    {
      label: "Generate images",
      href: `/app/marketing/studio?product_id=${productId}`,
      Icon: Photo,
    },
    {
      label: "Make a video",
      href: `/app/marketing/video?product_id=${productId}`,
      Icon: Camera,
    },
  ]

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center gap-x-2 px-6 py-4">
        <Sparkles className="text-ui-fg-subtle" />
        <div>
          <Heading level="h2">Promote</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Turn this product into marketing content.
          </Text>
        </div>
      </div>
      <div className="flex flex-col gap-y-2 px-6 py-4">
        {actions.map((action) => (
          <Button
            key={action.href}
            asChild
            variant="secondary"
            className="w-full justify-start"
          >
            <a href={action.href}>
              <action.Icon className="text-ui-fg-subtle" />
              {action.label}
            </a>
          </Button>
        ))}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: "product.details.after",
})

export default MarketingPromoteWidget
