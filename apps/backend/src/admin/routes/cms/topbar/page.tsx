import { MovedToEditor } from "../../../components/cms/moved-to-editor"

/**
 * The top bar / announcement bar is now edited in the visual editor (select
 * "Top bar" under Site elements). Kept as a redirect surface for old links;
 * removed from the sidebar (no `config` export). Previous EditorShell
 * implementation is in git history.
 */
const TopbarEditorPage = () => (
  <MovedToEditor title="Top bar" what="Your announcement message and top-bar links" />
)

export default TopbarEditorPage
