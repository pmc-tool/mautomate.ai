-- Gap fixes round 2 (companion to namespace-freedom.sql / customer-freedom.sql)
--
-- 1. Tag/type values unique PER STORE (same pattern as handles).
-- 2. Per-store order numbering: counter table + backfill store_order_no into
--    order.metadata (numbered by created_at per tenant). Orders of purged
--    stores stay unnumbered and fall back to display_id in every UI.
-- 3. Guest customers stamped from their orders (single-tenant guests only —
--    a guest with orders at 2+ stores is ambiguous and stays unstamped).
-- 4. Retire the two dead platform-test accounts squatting their emails
--    (0 orders each; auth identities untouched — they may back admin users).

BEGIN;

-- ------------------------------------------------------ 1. tag/type indexes
DROP INDEX IF EXISTS "IDX_tag_value_unique";
CREATE UNIQUE INDEX "IDX_tag_value_tenant_unique"
  ON product_tag (value, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_type_value_unique";
CREATE UNIQUE INDEX "IDX_type_value_tenant_unique"
  ON product_type (value, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

-- ------------------------------------------------------ 2. order numbering
CREATE TABLE IF NOT EXISTS tenant_order_counter (
  tenant_id text PRIMARY KEY,
  n bigint NOT NULL DEFAULT 0
);

WITH numbered AS (
  SELECT o.id, t.id AS tenant_id,
         row_number() OVER (PARTITION BY t.id ORDER BY o.created_at, o.id) AS rn
  FROM "order" o
  JOIN tenant t ON (t.meta->>'sales_channel_id') = o.sales_channel_id
  WHERE (o.metadata->>'store_order_no') IS NULL
)
UPDATE "order" o
SET metadata = coalesce(o.metadata, '{}'::jsonb)
  || jsonb_build_object('store_order_no', numbered.rn, 'tenant_id', numbered.tenant_id)
FROM numbered
WHERE o.id = numbered.id;

INSERT INTO tenant_order_counter (tenant_id, n)
SELECT o.metadata->>'tenant_id', max((o.metadata->>'store_order_no')::bigint)
FROM "order" o
WHERE (o.metadata->>'store_order_no') IS NOT NULL
  AND (o.metadata->>'tenant_id') IS NOT NULL
GROUP BY 1
ON CONFLICT (tenant_id) DO UPDATE SET n = GREATEST(tenant_order_counter.n, EXCLUDED.n);

-- ------------------------------------------------------ 3. guest stamps
UPDATE customer c
SET metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', x.tid)
FROM (
  SELECT o.customer_id AS cid, min(t.id) AS tid
  FROM "order" o
  JOIN tenant t ON (t.meta->>'sales_channel_id') = o.sales_channel_id
  WHERE o.customer_id IS NOT NULL
  GROUP BY o.customer_id
  HAVING count(DISTINCT t.id) = 1
) x
WHERE c.id = x.cid
  AND c.deleted_at IS NULL
  AND (c.metadata->>'tenant_id') IS NULL;

-- ------------------------------------------------------ 4. dead test accounts
UPDATE customer SET deleted_at = now()
WHERE email IN ('admin@brandtodoor.com', 'owner@demo-store.com')
  AND deleted_at IS NULL;

COMMIT;
