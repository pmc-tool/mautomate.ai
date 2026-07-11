import { defineRouteConfig } from "@medusajs/admin-sdk"
import { MagnifyingGlass } from "@medusajs/icons"
import { Select } from "@medusajs/ui"
import {
  EditorShell,
  Field,
  Grid,
  LocalizedText,
  Section,
  TextField,
  useSettingEditor,
} from "../../../components/cms/cms-ui"

const TWITTER_CARDS = ["summary", "summary_large_image"]

const SeoEditorPage = () => {
  const ctx = useSettingEditor("seo_defaults")

  return (
    <EditorShell
      ctx={ctx}
      title="SEO defaults"
      description="Fallback metadata used when a page does not set its own."
      localizable
      render={() => (
        <>
          <Section title="Metadata">
            <LocalizedText ctx={ctx} path={["title"]} label="Default title" />
            <LocalizedText
              ctx={ctx}
              path={["description"]}
              label="Default description"
              textarea
              rows={3}
            />
            {ctx.locale === "en" && (
              <Grid>
                <TextField
                  ctx={ctx}
                  path={["title_template"]}
                  label="Title template"
                  placeholder="%s | Forever Finds"
                  hint="%s is replaced by the page title."
                />
              </Grid>
            )}
          </Section>

          {ctx.locale === "en" && (
            <Section title="Social sharing">
              <Grid>
                <TextField
                  ctx={ctx}
                  path={["og_image"]}
                  label="Open Graph image"
                  placeholder="/learts/assets/images/logo/forever-finds.png"
                />
                <Field label="Twitter card type">
                  <Select
                    value={ctx.en?.twitter_card}
                    onValueChange={(v) =>
                      ctx.updateEn((d) => {
                        d.twitter_card = v
                      })
                    }
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select a card type" />
                    </Select.Trigger>
                    <Select.Content>
                      {TWITTER_CARDS.map((c) => (
                        <Select.Item key={c} value={c}>
                          {c}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </Field>
              </Grid>
            </Section>
          )}
        </>
      )}
    />
  )
}

export const config = defineRouteConfig({
  label: "SEO",
  icon: MagnifyingGlass,
})

export default SeoEditorPage
