import { Container, Heading, Text, Button } from "@medusajs/ui"
import { PencilSquare } from "@medusajs/icons"

/**
 * Placeholder shown on the standalone chrome settings routes (Header, Top bar,
 * Footer, Colors & fonts) after they were consolidated into the visual editor.
 *
 * These routes are kept (not deleted) so old bookmarks / links still resolve —
 * they now simply point the user to the single place this content is edited.
 * The visual editor is opened via the token-minting admin redirect so the
 * preview secret never ships in the admin bundle.
 */
export const MovedToEditor = ({
  title,
  what,
}: {
  title: string
  what: string
}) => (
  <Container className="p-8 flex flex-col items-start gap-3">
    <Heading level="h2">{title}</Heading>
    <Text className="text-ui-fg-subtle max-w-xl">
      {what} is now edited visually in the Visual Editor, alongside the rest of
      your storefront — one place to design everything, with a live preview.
    </Text>
    <a href="/admin/cms/visual-editor?slug=home&locale=en">
      <Button variant="primary" className="mt-2">
        <PencilSquare />
        Open Visual Editor
      </Button>
    </a>
  </Container>
)

export default MovedToEditor
