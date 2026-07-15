import { MedusaService } from "@medusajs/framework/utils"
import Theme from "./models/theme"
import ThemeVersion from "./models/theme-version"
import ThemeFile from "./models/theme-file"

/**
 * Theme module service.
 *
 * Generated CRUD:
 *   Theme        -> createThemes / listThemes / retrieveTheme / updateThemes / deleteThemes
 *   ThemeVersion -> createThemeVersions / listThemeVersions / ...
 *   ThemeFile    -> createThemeFiles / listThemeFiles / ...
 */
class ThemeModuleService extends MedusaService({
  Theme,
  ThemeVersion,
  ThemeFile,
}) {}

export default ThemeModuleService
