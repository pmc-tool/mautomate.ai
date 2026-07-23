/* ------------------------------------------------------------------ */
/* cms-contract — spec-language types.                                  */
/*                                                                     */
/* The runtime home of the generated-validator spec language is the     */
/* backend interpreter (it executes specs in the publish path); this    */
/* is a TYPE-ONLY projection so the generator and annotations           */
/* typecheck against the exact same definitions. Type-only: nothing     */
/* from the backend is bundled into generator output.                   */
/* ------------------------------------------------------------------ */

export type {
  FieldCheck,
  BlockSpec,
} from "../../../apps/backend/src/modules/cms/registry/generated/interpreter"
