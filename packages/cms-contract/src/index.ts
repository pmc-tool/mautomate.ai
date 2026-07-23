/* ------------------------------------------------------------------ */
/* @dtc/cms-contract — the single CMS schema contract (Phase 4B,        */
/* ARCH-CORE §4 "Schema / registry unification").                       */
/*                                                                     */
/* WHAT THIS PACKAGE IS                                                 */
/* One import surface for the ONE FieldDef catalog that describes the   */
/* 13 CMS block types: block field schemas + defaults, the widget       */
/* vocabulary, the universal Style/Advanced field sets, and the          */
/* TypeScript types — plus the backend publish-validation annotations   */
/* and the generator that derives the backend validators from them.     */
/*                                                                     */
/* RESOLUTION MECHANISM (deliberate, read before "fixing")              */
/* The catalog's PHYSICAL source stays at                               */
/*   apps/storefront/src/modules/cms/schema/**                          */
/* and this package re-exports it. Why not move the files here:         */
/*   1. The monorepo's npm workspaces are `apps/**` only; linking a     */
/*      real `packages/*` workspace requires `npm install`, which is    */
/*      PROHIBITED on this deployment (node_modules carries hand-       */
/*      applied patches — see the namespace-freedom core patch — and    */
/*      a postinstall patch-package chain).                             */
/*   2. The storefront's `next build` webpack pipeline only transpiles   */
/*      TS inside the app dir by default; moving the source out would   */
/*      gamble the production build on `experimental.externalDir`,      */
/*      which cannot be proven here (builds are integrator-only).       */
/*   3. The backend compiles with `rootDir: "./"` — it can NEVER import  */
/*      cross-app source directly. It consumes GENERATED artifacts       */
/*      (contract.gen.ts) emitted by this package's generator, so       */
/*      backend resolution is unaffected by where the catalog lives.    */
/* Net effect: storefront imports are untouched (byte-identical), the   */
/* backend imports only generated files, and every tool that needs the  */
/* catalog imports THIS package. When a safe npm-install window exists, */
/* the physical files can move here and the re-export direction flips   */
/* without changing any consumer.                                       */
/*                                                                     */
/* CONSUMERS                                                            */
/*   - generate.ts (this package): emits                                */
/*     apps/backend/src/modules/cms/registry/generated/contract.gen.ts  */
/*   - backend registry: shadow-runs generated validators (registry/    */
/*     index.ts), container validator excluded by design.               */
/*   - backend AI digests: field-spec lines from CONTRACT_FIELDS.       */
/*   - (future, ARCH-CORE §4) theme validator BLOCK_TYPES + contract.md */
/*     for theme authors.                                               */
/* ------------------------------------------------------------------ */

/* The full catalog: BLOCK_SCHEMAS, getBlockSchema, getPanelSchema,
 * FieldDef/BlockSchema types, responsive + link + hide helpers,
 * defaultPropsFromSchema/validatePropsFromSchema, and the widget
 * vocabulary (WIDGET_SCHEMAS, BASIC/COMMERCE_WIDGET_TYPES, …). */
export * from "../../../apps/storefront/src/modules/cms/schema/index"

/* Universal field sets (also reachable via getPanelSchema, exported
 * here so backend tooling can reason about the style/advanced bags). */
export {
  UNIVERSAL_STYLE,
  defaultStyle,
} from "../../../apps/storefront/src/modules/cms/schema/universal/style"
export {
  UNIVERSAL_ADVANCED,
  defaultAdvanced,
} from "../../../apps/storefront/src/modules/cms/schema/universal/advanced"

/* Backend publish-validation semantics (the annotation overlay). */
export {
  BACKEND_ANNOTATIONS,
  GENERATED_TYPES,
  type BlockBackendAnnotation,
} from "./backend-annotations"

/* Spec-language types (type-only projection of the backend interpreter). */
export type { FieldCheck, BlockSpec } from "./generated-types"
