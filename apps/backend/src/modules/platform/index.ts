import { Module } from "@medusajs/framework/utils"
import PlatformModuleService from "./service"

export const PLATFORM_MODULE = "platform"

export default Module(PLATFORM_MODULE, {
  service: PlatformModuleService,
})
