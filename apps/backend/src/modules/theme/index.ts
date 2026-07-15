import { Module } from "@medusajs/framework/utils"
import ThemeModuleService from "./service"

export const THEME_MODULE = "theme"

export default Module(THEME_MODULE, {
  service: ThemeModuleService,
})
