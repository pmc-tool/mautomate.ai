import { MovedToEditor } from "../../../components/cms/moved-to-editor"

/**
 * Colors & fonts are now edited in the visual editor ("Colors & fonts" panel).
 * This route is kept as a redirect surface for old links; it is no longer in the
 * sidebar (no `config` export). To restore the standalone editor, git history
 * has the previous EditorShell-based implementation.
 */
const ThemeEditorPage = () => (
  <MovedToEditor title="Colors & fonts" what="Your brand colors, fonts and logo" />
)

export default ThemeEditorPage
