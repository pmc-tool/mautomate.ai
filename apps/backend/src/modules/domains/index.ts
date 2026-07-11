import { Module } from "@medusajs/framework/utils"
import DomainsModuleService from "./service"

export const DOMAINS_MODULE = "domains"

export default Module(DOMAINS_MODULE, {
  service: DomainsModuleService,
})
