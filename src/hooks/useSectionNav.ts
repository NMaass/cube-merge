import { useEffect, useState, useCallback, useRef } from 'react'
import { Section } from '../types/cube'

export function useSectionNav(sections: Section[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections

  function scrollToSection(index: number) {
    const section = sectionsRef.current[index]
    if (!section) return
    for (const side of ['left', 'right'] as const) {
      const el = document.getElementById(`section-${side}-${section.key}`)
      if (!el) continue
      const panel = el.closest('.overflow-y-auto') as HTMLElement | null
      if (!panel) continue
      // Offset past the sticky panel header ("Removals" / "Additions")
      const stickyHeader = panel.querySelector('.sticky') as HTMLElement | null
      const headerHeight = stickyHeader ? stickyHeader.getBoundingClientRect().height : 34
      const panelRect = panel.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      panel.scrollTo({ top: panel.scrollTop + elRect.top - panelRect.top - headerHeight, behavior: 'smooth' })
    }
  }

  const goNext = useCallback(() => {
    setCurrentIndex(i => {
      const next = Math.min(i + 1, sectionsRef.current.length - 1)
      setTimeout(() => scrollToSection(next), 0)
      return next
    })
  }, [])

  const goPrev = useCallback(() => {
    setCurrentIndex(i => {
      const prev = Math.max(i - 1, 0)
      setTimeout(() => scrollToSection(prev), 0)
      return prev
    })
  }, [])

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, sectionsRef.current.length - 1))
    setCurrentIndex(clamped)
    setTimeout(() => scrollToSection(clamped), 0)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'n') goNext()
      if (e.key === 'p') goPrev()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goNext, goPrev])

  useEffect(() => { setCurrentIndex(0) }, [sections.length])

  return { currentIndex, goNext, goPrev, goTo, total: sections.length }
}
