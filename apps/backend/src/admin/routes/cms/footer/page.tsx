import { MovedToEditor } from "../../../components/cms/moved-to-editor"

/**
 * The footer is now edited in the visual editor (select "Footer" under Site
 * elements). Kept as a redirect surface for old links; removed from the sidebar
 * (no `config` export). Previous EditorShell implementation is in git history.
 */
const FooterEditorPage = () => (
  <MovedToEditor title="Footer" what="Your footer contact details, links, social and newsletter" />
)

export default FooterEditorPage
