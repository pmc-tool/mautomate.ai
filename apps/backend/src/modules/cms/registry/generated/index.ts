/* ------------------------------------------------------------------ */
/* Generated-validator entry (Phase 4B, ARCH-CORE §4).                  */
/*                                                                     */
/* `generatedValidate` is the contract-derived twin of each block's     */
/* hand-written validate(). It is consumed by registry/index.ts in      */
/* SHADOW MODE: both validators run, divergences are counted+logged,    */
/* and the OLD result is returned until the cutover flag                */
/* (CMS_CONTRACT_VALIDATORS=1) flips after a clean week of publish      */
/* traffic.                                                             */
/*                                                                     */
/* THE CONTAINER EXCEPTION (codified, not generated): container's       */
/* permissiveness — any object with a string `widget_type` passes,      */
/* every other widget key is passthrough — is a FORWARD-COMPATIBILITY   */
/* GUARANTEE (new storefront widget types must never require a backend  */
/* deploy). It is a policy, not a schema artifact, so it is excluded    */
/* from generation permanently and delegated to the hand-written        */
/* validator here.                                                      */
/* ------------------------------------------------------------------ */

import type { BlockValidationResult } from "../types"
import { containerBlock } from "../container"
import { GENERATED_SPECS } from "./contract.gen"
import { validateWithSpec } from "./interpreter"

export {
  CONTRACT_VERSION,
  CONTRACT_FIELDS,
  CONTRACT_DEFAULTS,
  type ContractField,
  type ContractFieldKind,
} from "./contract.gen"
export type { BlockSpec, FieldCheck } from "./interpreter"

/**
 * Contract-generated validation for `type`, or null when the type has no
 * generated spec (unregistered types stay pass-through upstream).
 * Never throws.
 */
export function generatedValidate(
  type: string,
  data: unknown
): BlockValidationResult | null {
  if (type === "container") {
    // Hand-written by design — see the header.
    return containerBlock.validate(data)
  }
  const spec = GENERATED_SPECS[type]
  if (!spec) {
    return null
  }
  return validateWithSpec(spec, data)
}
