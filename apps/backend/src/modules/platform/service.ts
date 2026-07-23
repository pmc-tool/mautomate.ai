import { MedusaService } from "@medusajs/framework/utils"

import Tenant from "./models/tenant"
import TenantDomain from "./models/tenant-domain"
import ProvisioningJob from "./models/provisioning-job"
import TenantKey from "./models/tenant-key"
import TenantConfig from "./models/tenant-config"
import CreditWallet from "./models/credit-wallet"
import CreditTransaction from "./models/credit-transaction"
import CreditReservation from "./models/credit-reservation"
import CreditLot from "./models/credit-lot"
import UsageEvent from "./models/usage-event"
import AuditLog from "./models/audit-log"
import PlatformPackage from "./models/platform-package"
import PriceBookEntry from "./models/price-book-entry"
import StorefrontTheme from "./models/storefront-theme"
import SupportTicket from "./models/support-ticket"
import Partner from "./models/partner"
import PartnerReferral from "./models/partner-referral"
import PartnerCommission from "./models/partner-commission"
import PartnerPayout from "./models/partner-payout"
import MerchantReferral from "./models/merchant-referral"
import BlogPost from "./models/blog-post"
import Merchant from "./models/merchant"
import MerchantDevice from "./models/merchant-device"
import MobileAppOrder from "./models/mobile-app-order"

/**
 * Platform (control-plane) module service — generated CRUD for the mAutomate
 * tenancy + billing backbone. The money-safe ATOMIC wallet mutations (the
 * `WHERE balance >= amount` conditional decrement that MedusaService.update
 * cannot express) run as raw SQL on the shared pg connection inside
 * SqlWalletStore (credits/stores.ts), verified by the concurrent-burn test.
 */
class PlatformModuleService extends MedusaService({
  Tenant,
  TenantDomain,
  ProvisioningJob,
  TenantKey,
  TenantConfig,
  CreditWallet,
  CreditTransaction,
  CreditReservation,
  CreditLot,
  UsageEvent,
  AuditLog,
  PlatformPackage,
  PriceBookEntry,
  StorefrontTheme,
  SupportTicket,
  Partner,
  PartnerReferral,
  PartnerCommission,
  PartnerPayout,
  MerchantReferral,
  BlogPost,
  Merchant,
  MerchantDevice,
  MobileAppOrder,
}) {}

export default PlatformModuleService
