import { CubeCard } from '../types/cube'
import { ChangeType } from '../types/firestore'

/** Whether a type belongs to the negative polarity (keep/reject/decline). */
export function isNegativePolarity(type: ChangeType): boolean {
  return type === 'keep' || type === 'reject' || type === 'decline'
}

/** Derives the canonical type from card composition + polarity.
 *  Polarity is encoded in the baseType:
 *    Positive (remove/add/swap) — standard changes
 *    Negative (keep/reject/decline) — reversed resolution */
export function computeChangeType(
  cardsOut: CubeCard[],
  cardsIn: CubeCard[],
  baseType: ChangeType
): ChangeType {
  const negative = isNegativePolarity(baseType)
  const hasOut = cardsOut.length > 0
  const hasIn = cardsIn.length > 0

  if (negative) {
    if (hasOut && hasIn) return 'decline'
    if (hasOut) return 'keep'
    if (hasIn) return 'reject'
    return baseType
  } else {
    if (hasOut && hasIn) return 'swap'
    if (hasOut) return 'remove'
    if (hasIn) return 'add'
    return baseType
  }
}
