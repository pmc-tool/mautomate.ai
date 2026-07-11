import { MedusaService } from "@medusajs/framework/utils"
import DomainModel from "./models/domain"
import DomainOrder from "./models/domain-order"
import DomainContact from "./models/domain-contact"

/**
 * Domains module service — generated CRUD for the domain registrar entities.
 * Tenant-ready (every model carries `tenant_id`); scoping is applied at the
 * API/middleware layer. Generated CRUD mirrors the codebase pattern:
 *   DomainModel   -> createDomains / listDomains / listAndCountDomains
 *                    / retrieveDomain / updateDomains / deleteDomains
 *   DomainOrder   -> createDomainOrders / listDomainOrders / ...
 *   DomainContact -> createDomainContacts / listDomainContacts / ...
 */
class DomainsModuleService extends MedusaService({
  DomainModel,
  DomainOrder,
  DomainContact,
}) {}

export default DomainsModuleService
