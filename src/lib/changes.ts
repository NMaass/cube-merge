import { CubeCard } from '../types/cube'
import { ChangeType } from '../types/firestore'

/** Derives the canonical type from what's actually in the change.
 *  Keep and reject are anchored — they never morph into other types.
 *  Standard types (add/remove/swap) transition freely based on card composition. */
export function computeChangeType(
  cardsOut: CubeCard[],
  cardsIn: CubeCard[],
  baseType: ChangeType
): ChangeType {
  if (baseType === 'keep' || baseType === 'reject') return baseType
  const hasOut = cardsOut.length > 0
  const hasIn = cardsIn.length > 0
  if (hasIn && hasOut) return 'swap'
  if (hasIn) return 'add'
  if (hasOut) return 'remove'
  return baseType
}
