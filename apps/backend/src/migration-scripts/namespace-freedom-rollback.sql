-- Rollback of namespace-freedom.sql: restore the original GLOBAL unique
-- indexes (exact definitions captured from production 2026-07-16). FAILS if
-- cross-store duplicates were created after the swap — resolve those first.
-- The tenant_id metadata stamps are left in place (harmless, and correct).

BEGIN;

DROP INDEX IF EXISTS "IDX_product_handle_tenant_unique";
CREATE UNIQUE INDEX "IDX_product_handle_unique" ON product USING btree (handle) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_category_handle_tenant_unique";
CREATE UNIQUE INDEX "IDX_category_handle_unique" ON product_category USING btree (handle) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_collection_handle_tenant_unique";
CREATE UNIQUE INDEX "IDX_collection_handle_unique" ON product_collection USING btree (handle) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_product_variant_sku_tenant_unique";
CREATE UNIQUE INDEX "IDX_product_variant_sku_unique" ON product_variant USING btree (sku) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_product_variant_barcode_tenant_unique";
CREATE UNIQUE INDEX "IDX_product_variant_barcode_unique" ON product_variant USING btree (barcode) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_product_variant_ean_tenant_unique";
CREATE UNIQUE INDEX "IDX_product_variant_ean_unique" ON product_variant USING btree (ean) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_product_variant_upc_tenant_unique";
CREATE UNIQUE INDEX "IDX_product_variant_upc_unique" ON product_variant USING btree (upc) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_inventory_item_sku_tenant_unique";
CREATE UNIQUE INDEX "IDX_inventory_item_sku" ON inventory_item USING btree (sku) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_customer_group_name_tenant_unique";
CREATE UNIQUE INDEX "IDX_customer_group_name_unique" ON customer_group USING btree (name) WHERE (deleted_at IS NULL);

DROP INDEX IF EXISTS "IDX_shipping_profile_name_tenant_unique";
CREATE UNIQUE INDEX "IDX_shipping_profile_name_unique" ON shipping_profile USING btree (name) WHERE (deleted_at IS NULL);

COMMIT;
