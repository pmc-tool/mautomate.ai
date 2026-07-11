import { Module } from "@medusajs/framework/utils"
import CallCenterModuleService from "./service"

export const CALL_CENTER_MODULE = "call_center"

export default Module(CALL_CENTER_MODULE, {
  service: CallCenterModuleService,
})
