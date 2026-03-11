interface HoverCardPreviewProps {
  imageUrl: string | undefined
  visible: boolean
}

export function HoverCardPreview({ imageUrl, visible }: HoverCardPreviewProps) {
  if (!visible || !imageUrl) return null

  return (
    <div className="absolute z-50 pointer-events-none" style={{ left: '100%', top: 0, marginLeft: 8 }}>
      <img
        src={imageUrl}
        alt="Card preview"
        className="w-48 rounded-lg shadow-2xl border border-slate-600"
        style={{ aspectRatio: '63/88' }}
        loading="lazy"
      />
    </div>
  )
}
