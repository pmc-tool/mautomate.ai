-- Per-store customer accounts: one person may hold an account (same email)
-- at multiple stores. Companion to namespace-freedom.sql; the LOGIN identity
-- side is handled by tenant-tagged auth emails at the storefront boundary.
-- Guests/legacy rows keep the '' bucket (global-unique semantics, unchanged).
BEGIN;
DROP INDEX IF EXISTS "IDX_customer_email_has_account_unique";
CREATE UNIQUE INDEX "IDX_customer_email_account_tenant_unique"
  ON customer (email, has_account, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;
COMMIT;

-- ROLLBACK (fails if cross-store duplicate accounts exist by then):
--   DROP INDEX IF EXISTS "IDX_customer_email_account_tenant_unique";
--   CREATE UNIQUE INDEX "IDX_customer_email_has_account_unique"
--     ON customer (email, has_account) WHERE (deleted_at IS NULL);
