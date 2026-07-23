/* ------------------------------------------------------------------ */
/* Wave 2 body registrations.                                           */
/*                                                                     */
/* Import each bespoke card body file here for its registerCardBody()     */
/* side-effect. The OS imports this barrel once at startup. Keeping all     */
/* registrations in one place makes the bespoke set discoverable and the      */
/* load order deterministic.                                                   */
/*                                                                            */
/* Wave 2: add a line per body, e.g.                                           */
/*   import "./orders/list-recent-orders"                                        */
/*   import "./overview/needs-attention"                                          */
/* ------------------------------------------------------------------ */

export {}

// insights (read/insight tool bodies)
import "./insights/store-overview"
import "./insights/sales-summary"
import "./insights/list-recent-orders"
import "./insights/get-order"
import "./insights/search-products"
import "./insights/low-stock"
import "./insights/find-customer"
import "./insights/check-readiness"
import "./insights/needs-attention"

// ops
import "./ops/orders-to-deliver"
import "./ops/delivery-issues"
import "./ops/needs-human"
import "./ops/inbox-status"
import "./ops/todays-email"

// growth
import "./growth/visitor-report"
import "./growth/ad-report"
import "./growth/compare-ads"
import "./growth/call-center-status"
import "./growth/call-topics"
import "./growth/domain-status"

// actions
import "./actions/blog"
import "./actions/publish"
import "./actions/ads"
import "./actions/discount"
import "./actions/marketing"
import "./actions/order-sensitive"
import "./actions/order-money"
import "./actions/brand"
import "./actions/product"
