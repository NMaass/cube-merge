import { useState } from 'react'
import { CubeCard } from '../types/cube'
import { getCachedImage } from '../lib/imageCache'

/**
 * Manages the preview card state + image URL for FullscreenCardModal.
 * Returns a setter, a close handler, and derived props for the modal.
 */
export function useCardPreview() {
  const [previewCard, setPreviewCard] = useState<CubeCard | null>(null)

  return {
    previewCard,
    setPreviewCard,
    previewModalProps: {
      open: !!previewCard,
      onClose: () => setPreviewCard(null),
      cardName: previewCard?.name ?? '',
      imageUrl: previewCard ? getCachedImage(previewCard.name) ?? undefined : undefined,
    },
  }
}
