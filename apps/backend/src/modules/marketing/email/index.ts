/**
 * Email subsystem bootstrap + public surface. Importing this loads and registers
 * the email transport(s). Reach the registry getters + helpers through here.
 * To add a transport: create it under `./providers/<name>.ts` (self-registering
 * via `registerEmailProvider`) and add its import to the list below.
 */

// --- Transport registration --------------------------------------------------
import "./providers/smtp"

// --- Public surface ----------------------------------------------------------
export {
  getEmailProvider,
  listEmailProviders,
  registerEmailProvider,
  isEmailConfigured,
} from "./registry"
export * from "./types"
export * from "./tokens"
