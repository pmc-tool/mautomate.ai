import { MovedToEditor } from "../../../components/cms/moved-to-editor"

/**
 * The header is now edited in the visual editor (select "Header" under Site
 * elements). Kept as a redirect surface for old links; removed from the sidebar
 * (no `config` export). Previous EditorShell implementation is in git history.
 */
const HeaderEditorPage = () => (
  <MovedToEditor title="Header" what="Your logo, search, navigation and header icons" />
)

export default HeaderEditorPage
