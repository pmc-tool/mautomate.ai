/* ------------------------------------------------------------------ */
/* Puck <-> CMS section conversion                                      */
/*                                                                     */
/* Puck content items are { type, props:{ id, ...data } }; our snapshot  */
/* sections are { block_type, schema_version, ...data }. The Puck `type` */
/* IS the block_type (see puck/config.tsx keys), so conversion is a flat */
/* rename + id strip.                                                    */
/* ------------------------------------------------------------------ */

import type { Data } from "@puckeditor/core"

export type CmsSectionLike = { block_type: string; [k: string]: unknown }

/** Snapshot sections -> Puck Data (for loading a page into the editor). */
export function toPuckData(sections: CmsSectionLike[] | undefined): Data {
  const content = (sections ?? []).map((s, i) => {
    const { block_type, schema_version, ...rest } = s as Record<string, unknown> & {
      block_type: string
      schema_version?: number
    }
    return { type: block_type, props: { id: `${block_type}-${i}`, ...rest } }
  })
  return { root: {}, content } as unknown as Data
}

/** Puck Data content -> snapshot sections (for publishing). */
export function fromPuckContent(data: Data | undefined): CmsSectionLike[] {
  const content = (data?.content ?? []) as { type: string; props?: Record<string, unknown> }[]
  return content.map((c) => {
    const { id, ...rest } = c.props ?? {}
    return { block_type: c.type, ...rest }
  })
}
