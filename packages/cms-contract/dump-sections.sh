#!/usr/bin/env bash
# cms-contract shadow probe input: dump every draft + snapshot section from
# the live DB into /home/ratul/4b-work/db-sections.json as
# [{src, type, data}] rows. Read-only.
set -euo pipefail

DB_URL="${DATABASE_URL:-$(grep -m1 '^DATABASE_URL=' /home/ratul/brandtodoor/apps/backend/.env | cut -d= -f2-)}"
OUT="${1:-/home/ratul/4b-work/db-sections.json}"

psql "$DB_URL" -t -A <<'SQL' > "$OUT"
with draft_sections as (
  select 'draft:' || d.id as src,
         s->>'block_type' as type,
         (s - 'block_type' - 'style' - 'advanced' - 'elementStyles' - 'id' - 'schema_version') as data
  from cms_page_draft d,
       jsonb_array_elements(coalesce(d.data->'content', '[]'::jsonb)) s
  where jsonb_typeof(d.data->'content') = 'array'
    and jsonb_typeof(s) = 'object'
),
snapshot_sections as (
  -- snapshot sections are FLATTENED: props + block_type + schema_version
  select 'snapshot:' || n.id as src,
         s->>'block_type' as type,
         (s - 'block_type' - 'style' - 'advanced' - 'elementStyles' - 'id' - 'schema_version') as data
  from cms_snapshot n,
       jsonb_array_elements(coalesce(n.data->'sections', '[]'::jsonb)) s
  where jsonb_typeof(n.data->'sections') = 'array'
    and jsonb_typeof(s) = 'object'
)
select coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
from (
  select * from draft_sections where type is not null
  union all
  select * from snapshot_sections where type is not null
) t;
SQL

echo "wrote $OUT ($(node -e "console.log(JSON.parse(require('fs').readFileSync('$OUT','utf8')).length)") sections)"
