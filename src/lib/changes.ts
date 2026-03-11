import { CubeCard } from '../types/cube'
import { ChangeType } from '../types/firestore'

/** Derives the canonical type from what's actually in the change.
 *  Keep + add-side cards → 'add'.
 *  Remove + add-side cards → 'swap'.
 *  Reject is preserved only when there are no cardsOut. */
export function computeChangeType(
  cardsOut: CubeCard[],
  cardsIn: CubeCard[],
  baseType: ChangeType
): ChangeType {
  const hasOut = cardsOut.length > 0
  const hasIn = cardsIn.length > 0
  if (hasIn && hasOut) return baseType === 'keep' ? 'add' : 'swap'
  if (hasIn) return (baseType === 'reject') ? 'reject' : 'add'
  if (hasOut) return baseType === 'keep' ? 'keep' : 'remove'
  return baseType
}
