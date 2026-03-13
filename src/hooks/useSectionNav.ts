import { useEffect, useState, useCallback, useRef } from 'react'
import { Section } from '../types/cube'

export function useSectionNav(sections: Section[]) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections
  // Track whether a programmatic scroll is in progress to avoid observer conflicts
  const navigatingRef = useRef(false)

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
      navigatingRef.current = true
      setTimeout(() => {
        scrollToSection(next)
        setTimeout(() => { navigatingRef.current = false }, 600)
      }, 0)
      return next
    })
  }, [])

  const goPrev = useCallback(() => {
    setCurrentIndex(i => {
      const prev = Math.max(i - 1, 0)
      navigatingRef.current = true
      setTimeout(() => {
        scrollToSection(prev)
        setTimeout(() => { navigatingRef.current = false }, 600)
      }, 0)
      return prev
    })
  }, [])

  const goTo = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, sectionsRef.current.length - 1))
    setCurrentIndex(clamped)
    navigatingRef.current = true
    setTimeout(() => {
      scrollToSection(clamped)
      setTimeout(() => { navigatingRef.current = false }, 600)
    }, 0)
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

  // IntersectionObserver: update currentIndex as user scrolls
  useEffect(() => {
    if (sections.length === 0) return

    const intersecting = new Map<string, number>() // key → boundingClientRect.top

    const observer = new IntersectionObserver((entries) => {
      if (navigatingRef.current) return

      for (const entry of entries) {
        const key = entry.target.id.replace('section-left-', '')
        if (entry.isIntersecting) {
          intersecting.set(key, entry.boundingClientRect.top)
        } else {
          intersecting.delete(key)
        }
      }

      if (intersecting.size === 0) return

      // Pick topmost visible section
      let bestKey = ''
      let bestTop = Infinity
      for (const [k, top] of intersecting) {
        if (top < bestTop) { bestTop = top; bestKey = k }
      }

      const idx = sectionsRef.current.findIndex(s => s.key === bestKey)
      if (idx >= 0) setCurrentIndex(idx)
    }, { threshold: 0.1 })

    let rafId: number
    const setup = () => {
      for (const section of sectionsRef.current) {
        const el = document.getElementById(`section-left-${section.key}`)
        if (el) observer.observe(el)
      }
    }
    rafId = requestAnimationFrame(setup)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
    }
  }, [sections.length])

  return { currentIndex, goNext, goPrev, goTo, total: sections.length }
}
