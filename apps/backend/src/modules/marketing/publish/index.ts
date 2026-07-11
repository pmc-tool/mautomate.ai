/**
 * Publish subsystem bootstrap + public surface. Importing this module loads and
 * registers every platform adapter (side-effect imports below), so ALWAYS reach
 * the registry getters through here. To add a new platform: create the adapter
 * under `./providers/<platform>.ts` (which calls `registerProvider` on load)
 * and add its import to the list below.
 */

// --- Adapter registration (order matters: later wins for a shared slot) ------
import "./providers/mock"
import "./providers/wordpress"
import "./providers/telegram"
import "./providers/facebook"
import "./providers/instagram"
import "./providers/x"
import "./providers/linkedin"

// --- Public surface ----------------------------------------------------------
export {
  getPublishProvider,
  listPublishProviders,
  listConfiguredProviders,
  isPlatformConfigured,
  registerProvider,
} from "./registry"
export * from "./types"
export { sealCredentials, openCredentials } from "./credentials"
