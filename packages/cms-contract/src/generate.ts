/* ------------------------------------------------------------------ */
/* cms-contract — backend validator/spec GENERATOR (Phase 4B).          */
/*                                                                     */
/* Reads the FieldDef catalog (single source of structure) + the        */
/* backend annotations (single source of publish semantics) and emits   */
/*   apps/backend/src/modules/cms/registry/generated/contract.gen.ts   */
/* containing:                                                          */
/*   GENERATED_SPECS    declarative validators (12 blocks; container    */
/*                      excluded by design — stays hand-written)        */
/*   CONTRACT_FIELDS    compact field metadata for the AI digests       */
/*   CONTRACT_DEFAULTS  defaultPropsFromSchema per block (informational */
/*                      until cutover; runtime defaultData unchanged)   */
/*   CONTRACT_VERSION   content hash of everything above                */
/*                                                                     */
/* RUN (no npm scripts — the package is not npm-linked yet):            */
/*   cd /home/ratul/brandtodoor/packages/cms-contract                   */
/*   ../../node_modules/.bin/esbuild src/generate.ts --bundle           */
/*     --platform=node --format=cjs --outfile=/tmp/cms-contract-gen.cjs */
/*   node /tmp/cms-contract-gen.cjs [--check]                           */
/* `--check` regenerates in memory and exits 1 if the committed         */
/* contract.gen.ts is stale (drift gate for CI / the integrator).       */
/* ------------------------------------------------------------------ */

import crypto from "crypto"
import fs from "fs"
import path from "path"

import {
  BLOCK_SCHEMAS,
  defaultPropsFromSchema,
  type BlockSchema,
  type FieldDef,
} from "./index"
import {
  BACKEND_ANNOTATIONS,
  GENERATED_TYPES,
  type BlockBackendAnnotation,
} from "./backend-annotations"
import type { FieldCheck, BlockSpec } from "./generated-types"

/* ---------------- contract field metadata (for AI digests) ---------- */

type ContractFieldKind =
  | "text"
  | "html"
  | "img"
  | "url"
  | "color"
  | "date"
  | "id"
  | "num"
  | "bool"
  | "choice"
  | "obj"
  | "list"

interface ContractField {
  name: string
  kind: ContractFieldKind
  values?: string[]
  fields?: ContractField[]
}

const KIND_MAP: Record<string, ContractFieldKind> = {
  text: "text",
  textarea: "text",
  icon: "text",
  richText: "html",
  code: "html",
  image: "img",
  url: "url",
  link: "url",
  video: "url",
  color: "color",
  datetime: "date",
  product: "id",
  collection: "id",
  number: "num",
  range: "num",
  unitNumber: "num",
  boolean: "bool",
  select: "choice",
  choose: "choice",
  object: "obj",
  list: "list",
}

function contractField(f: FieldDef): ContractField {
  const kind = KIND_MAP[f.type] ?? "obj"
  const out: ContractField = { name: f.name, kind }
  if (kind === "choice" && f.options?.length) {
    out.values = f.options.map((o) => o.value)
  }
  if ((kind === "obj" || kind === "list") && f.fields?.length) {
    out.fields = f.fields.map(contractField)
  }
  return out
}

/* ---------------- spec generation ----------------------------------- */

const STRING_TYPES = new Set([
  "text",
  "textarea",
  "richText",
  "image",
  "url",
  "video",
  "color",
  "icon",
  "product",
  "collection",
  "link",
  "code",
])

interface GenCtx {
  type: string
  ann: BlockBackendAnnotation
  consumed: Set<string>
  report: string[]
}

function has(list: string[] | undefined, p: string, ctx: GenCtx): boolean {
  if (list?.includes(p)) {
    ctx.consumed.add(p)
    return true
  }
  return false
}

function hintFor(ctx: GenCtx, p: string): string | undefined {
  const h = ctx.ann.hints?.[p]
  if (h !== undefined) {
    ctx.consumed.add(`hint:${p}`)
  }
  return h
}

function checksForFields(
  fields: FieldDef[],
  prefix: string,
  ctx: GenCtx
): FieldCheck[] {
  const out: FieldCheck[] = []
  for (const f of fields) {
    const p = prefix ? `${prefix}.${f.name}` : f.name
    if (has(ctx.ann.skip, p, ctx)) {
      ctx.report.push(`  skip     ${ctx.type}.${p} (backend passthrough)`)
      continue
    }
    const required = has(ctx.ann.required, p, ctx)
    if (!!f.required !== required && f.type !== "object") {
      ctx.report.push(
        `  drift    ${ctx.type}.${p}: panel required=${!!f.required} publish required=${required}`
      )
    }

    if (f.type === "select" || f.type === "choose") {
      const values = (f.options ?? []).map((o) => o.value)
      const msgTail = ctx.ann.enumMsgTail?.[p]
      if (msgTail !== undefined) {
        ctx.consumed.add(`enumMsgTail:${p}`)
      }
      const kind = has(ctx.ann.enumRequired, p, ctx) ? "reqEnum" : "optEnum"
      out.push(
        msgTail !== undefined
          ? { kind, name: f.name, values, msgTail }
          : { kind, name: f.name, values }
      )
    } else if (f.type === "datetime" && has(ctx.ann.iso, p, ctx)) {
      out.push({ kind: "isoDate", name: f.name })
    } else if (f.type === "number" || f.type === "range" || f.type === "unitNumber") {
      out.push({ kind: "optNonNegNum", name: f.name })
    } else if (f.type === "boolean") {
      out.push({ kind: "optBool", name: f.name })
    } else if (f.type === "object") {
      out.push({
        kind: "group",
        name: f.name,
        required,
        fields: checksForFields(f.fields ?? [], p, ctx),
      })
    } else if (f.type === "list") {
      const noStop = has(ctx.ann.arrayNoStop, p, ctx)
      out.push({
        kind: "array",
        name: f.name,
        stop: !noStop,
        item: { fields: checksForFields(f.fields ?? [], `${p}[]`, ctx) },
      })
    } else if (STRING_TYPES.has(f.type)) {
      const hint = hintFor(ctx, p)
      if (required) {
        out.push(hint ? { kind: "reqStr", name: f.name, hint } : { kind: "reqStr", name: f.name })
      } else if (has(ctx.ann.alwaysString, p, ctx)) {
        out.push({ kind: "alwaysStr", name: f.name })
      } else {
        out.push(hint ? { kind: "optStr", name: f.name, hint } : { kind: "optStr", name: f.name })
      }
    } else {
      throw new Error(
        `cms-contract generate: no check mapping for ${ctx.type}.${p} (FieldDef type "${f.type}")`
      )
    }

    const injected = ctx.ann.injectAfter?.[p]
    if (injected) {
      ctx.consumed.add(`inject:${p}`)
      for (const ic of injected) {
        ctx.report.push(`  inject   ${ctx.type}.${p} → ${ic.kind} ${ic.name}`)
        out.push(ic)
      }
    }
  }
  return out
}

function specFor(schema: BlockSchema, ann: BlockBackendAnnotation, report: string[]): BlockSpec {
  const ctx: GenCtx = { type: schema.type, ann, consumed: new Set(), report }
  const fields = checksForFields(schema.fields, "", ctx)

  // Every annotation path must have been consumed — a stale path means the
  // catalog and the annotations have drifted apart. Fail loudly.
  const declared: string[] = [
    ...(ann.required ?? []),
    ...(ann.alwaysString ?? []),
    ...(ann.enumRequired ?? []),
    ...(ann.skip ?? []),
    ...(ann.arrayNoStop ?? []),
    ...(ann.iso ?? []),
    ...Object.keys(ann.hints ?? {}).map((p) => `hint:${p}`),
    ...Object.keys(ann.enumMsgTail ?? {}).map((p) => `enumMsgTail:${p}`),
    ...Object.keys(ann.injectAfter ?? {}).map((p) => `inject:${p}`),
  ]
  const stale = declared.filter((p) => !ctx.consumed.has(p))
  if (stale.length) {
    throw new Error(
      `cms-contract generate: annotation paths not found in the ${schema.type} catalog: ${stale.join(", ")}`
    )
  }
  return { type: schema.type, fields }
}

/* ---------------- emission ------------------------------------------ */

function generate(): { code: string; report: string[] } {
  const report: string[] = []
  const specs: Record<string, BlockSpec> = {}
  const contractFields: Record<string, ContractField[]> = {}
  const defaults: Record<string, Record<string, unknown>> = {}

  for (const type of GENERATED_TYPES) {
    const schema = BLOCK_SCHEMAS[type]
    if (!schema) {
      throw new Error(`cms-contract generate: no catalog schema for annotated type "${type}"`)
    }
    report.push(`${type}:`)
    specs[type] = specFor(schema, BACKEND_ANNOTATIONS[type], report)
    contractFields[type] = schema.fields.map(contractField)
    defaults[type] = defaultPropsFromSchema(schema)
  }
  // container: field metadata + defaults are still contract facts (the AI
  // digests and tooling may use them); its VALIDATOR is excluded by design.
  const container = BLOCK_SCHEMAS["container"]
  if (container) {
    contractFields["container"] = container.fields.map(contractField)
    defaults["container"] = defaultPropsFromSchema(container)
  }

  const body =
    `export const GENERATED_SPECS: Record<string, BlockSpec> = ${JSON.stringify(specs, null, 2)}\n\n` +
    `export const CONTRACT_FIELDS: Record<string, ContractField[]> = ${JSON.stringify(contractFields, null, 2)}\n\n` +
    `export const CONTRACT_DEFAULTS: Record<string, Record<string, unknown>> = ${JSON.stringify(defaults, null, 2)}\n`

  const version = crypto.createHash("sha256").update(body, "utf8").digest("hex").slice(0, 12)

  const code =
    `/* AUTO-GENERATED by packages/cms-contract/src/generate.ts — DO NOT EDIT.\n` +
    ` *\n` +
    ` * Source of structure: apps/storefront/src/modules/cms/schema (via\n` +
    ` * @dtc/cms-contract). Source of publish semantics:\n` +
    ` * packages/cms-contract/src/backend-annotations.ts.\n` +
    ` * Regenerate: see the header of generate.ts. Verify: shadow-probe.ts.\n` +
    ` *\n` +
    ` * The container validator is DELIBERATELY absent from GENERATED_SPECS\n` +
    ` * (hand-written permissiveness is a forward-compat guarantee —\n` +
    ` * ARCH-CORE §4); its field metadata below is informational only.\n` +
    ` */\n\n` +
    `import type { BlockSpec } from "./interpreter"\n\n` +
    `export const CONTRACT_VERSION = "${version}"\n\n` +
    `export type ContractFieldKind =\n` +
    `  | "text" | "html" | "img" | "url" | "color" | "date"\n` +
    `  | "id" | "num" | "bool" | "choice" | "obj" | "list"\n\n` +
    `export interface ContractField {\n` +
    `  name: string\n` +
    `  kind: ContractFieldKind\n` +
    `  values?: string[]\n` +
    `  fields?: ContractField[]\n` +
    `}\n\n` +
    body

  return { code, report }
}

function main() {
  const root = process.env.BRANDTODOOR_ROOT ?? "/home/ratul/brandtodoor"
  const outPath = path.join(
    root,
    "apps/backend/src/modules/cms/registry/generated/contract.gen.ts"
  )
  const { code, report } = generate()

  if (process.argv.includes("--check")) {
    const current = fs.existsSync(outPath) ? fs.readFileSync(outPath, "utf8") : ""
    if (current !== code) {
      console.error("cms-contract: contract.gen.ts is STALE — regenerate and re-run the shadow probe.")
      process.exit(1)
    }
    console.log("cms-contract: contract.gen.ts is up to date.")
    return
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, code)
  console.log(`cms-contract: wrote ${outPath}`)
  console.log("--- generation report (drift ledger) ---")
  for (const line of report) {
    console.log(line)
  }
}

main()
