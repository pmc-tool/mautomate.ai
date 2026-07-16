-- Namespace freedom: per-store uniqueness for merchant-visible identifiers.
--
-- 1. Stamp every catalog row with its owning tenant (derived from the
--    tenant's sales channel — the platform's isolation rule).
-- 2. Replace GLOBAL unique indexes with (value, tenant) unique indexes, so
--    two stores can both have handle "watch" / SKU "S-1" / group "VIP",
--    while duplicates WITHIN one store are still rejected.
--
-- Legacy/unstamped rows fall into the COALESCE('') bucket: they keep
-- global-unique semantics among themselves (fail-safe: never LOOSER than
-- before for unattributed data).
--
-- Rollback: namespace-freedom-rollback.sql (fails if cross-store duplicates
-- were created after the swap — expected and documented).

BEGIN;

-- ---------------------------------------------------------------- backfill
UPDATE product p
SET metadata = coalesce(p.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', t.id)
FROM product_sales_channel psc
JOIN tenant t ON (t.meta->>'sales_channel_id') = psc.sales_channel_id
WHERE psc.product_id = p.id
  AND p.deleted_at IS NULL
  AND (p.metadata->>'tenant_id') IS NULL;

UPDATE product_variant v
SET metadata = coalesce(v.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', p.metadata->>'tenant_id')
FROM product p
WHERE v.product_id = p.id
  AND v.deleted_at IS NULL
  AND (p.metadata->>'tenant_id') IS NOT NULL
  AND (v.metadata->>'tenant_id') IS NULL;

UPDATE inventory_item ii
SET metadata = coalesce(ii.metadata, '{}'::jsonb) || jsonb_build_object('tenant_id', v.metadata->>'tenant_id')
FROM product_variant_inventory_item pvii
JOIN product_variant v ON v.id = pvii.variant_id
WHERE pvii.inventory_item_id = ii.id
  AND ii.deleted_at IS NULL
  AND (v.metadata->>'tenant_id') IS NOT NULL
  AND (ii.metadata->>'tenant_id') IS NULL;

-- ------------------------------------------------------------ index swaps
DROP INDEX IF EXISTS "IDX_product_handle_unique";
CREATE UNIQUE INDEX "IDX_product_handle_tenant_unique"
  ON product (handle, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_category_handle_unique";
CREATE UNIQUE INDEX "IDX_category_handle_tenant_unique"
  ON product_category (handle, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_collection_handle_unique";
CREATE UNIQUE INDEX "IDX_collection_handle_tenant_unique"
  ON product_collection (handle, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_product_variant_sku_unique";
CREATE UNIQUE INDEX "IDX_product_variant_sku_tenant_unique"
  ON product_variant (sku, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_product_variant_barcode_unique";
CREATE UNIQUE INDEX "IDX_product_variant_barcode_tenant_unique"
  ON product_variant (barcode, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_product_variant_ean_unique";
CREATE UNIQUE INDEX "IDX_product_variant_ean_tenant_unique"
  ON product_variant (ean, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_product_variant_upc_unique";
CREATE UNIQUE INDEX "IDX_product_variant_upc_tenant_unique"
  ON product_variant (upc, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_inventory_item_sku";
CREATE UNIQUE INDEX "IDX_inventory_item_sku_tenant_unique"
  ON inventory_item (sku, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_customer_group_name_unique";
CREATE UNIQUE INDEX "IDX_customer_group_name_tenant_unique"
  ON customer_group (name, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

DROP INDEX IF EXISTS "IDX_shipping_profile_name_unique";
CREATE UNIQUE INDEX "IDX_shipping_profile_name_tenant_unique"
  ON shipping_profile (name, COALESCE(metadata->>'tenant_id', ''))
  WHERE deleted_at IS NULL;

COMMIT;
