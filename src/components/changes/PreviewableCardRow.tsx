import { PreviewableCardName } from '../cards/PreviewableCardName'

export function PreviewableCardRow({ cardName, colorClass, prefix }: {
  cardName: string
  colorClass: string
  prefix: string
}) {
  return (
    <PreviewableCardName
      cardName={cardName}
      className={`w-full text-sm py-1 select-none hover:opacity-80 active:opacity-60 ${colorClass}`}
    >
      {prefix} {cardName}
    </PreviewableCardName>
  )
}
