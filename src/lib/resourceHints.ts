// Resource hints for improving loading performance

/**
 * Add a DNS prefetch hint for faster domain resolution
 */
export function dnsPrefetch(url: string): void {
  if (typeof document === 'undefined') return
  
  try {
    const hostname = new URL(url).hostname
    
    // Check if already exists
    if (document.querySelector(`link[rel="dns-prefetch"][href*="${hostname}"]`)) {
      return
    }
    
    const link = document.createElement('link')
    link.rel = 'dns-prefetch'
    link.href = `//${hostname}`
    document.head.appendChild(link)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Resource Hints] Invalid URL for DNS prefetch:', url, err)
    }
  }
}

/**
 * Add a preconnect hint for faster connection setup
 */
export function preconnect(url: string, crossorigin = false): void {
  if (typeof document === 'undefined') return
  
  try {
    const hostname = new URL(url).hostname
    
    // Check if already exists
    const selector = `link[rel="preconnect"][href*="${hostname}"]`
    if (document.querySelector(selector)) {
      return
    }
    
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = `//${hostname}`
    if (crossorigin) {
      link.crossOrigin = 'anonymous'
    }
    document.head.appendChild(link)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Resource Hints] Invalid URL for preconnect:', url, err)
    }
  }
}

/**
 * Preload a specific resource
 */
export function preloadResource(url: string, type: 'image' | 'font' | 'style' | 'script' = 'image'): void {
  if (typeof document === 'undefined') return
  
  // Check if already exists
  if (document.querySelector(`link[rel="preload"][href="${url}"]`)) {
    return
  }
  
  const link = document.createElement('link')
  link.rel = 'preload'
  link.href = url
  link.as = type
  
  if (type === 'image') {
    link.fetchPriority = 'high'
  }
  
  if (type === 'font') {
    link.crossOrigin = 'anonymous'
  }
  
  document.head.appendChild(link)
}

/**
 * Prefetch resources for future navigation
 */
export function prefetchResource(url: string): void {
  if (typeof document === 'undefined') return
  
  // Check if already exists
  if (document.querySelector(`link[rel="prefetch"][href="${url}"]`)) {
    return
  }
  
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.href = url
  document.head.appendChild(link)
}

/**
 * Initialize common resource hints for the application
 */
export function initResourceHints(): void {
  // Preconnect to known external domains
  preconnect('https://fonts.googleapis.com')
  preconnect('https://fonts.gstatic.com', true)
  preconnect('https://firestore.googleapis.com')
  preconnect('https://api.scryfall.com')
  
  // Preconnect to image CDNs
  preconnect('https://cards.scryfall.io')
  preconnect('https://c1.scryfall.com')
  preconnect('https://c2.scryfall.com')
}

/**
 * Remove a resource hint to clean up
 */
export function removeResourceHint(url: string, rel = 'preload'): void {
  if (typeof document === 'undefined') return
  
  const link = document.querySelector(`link[rel="${rel}"][href="${url}"]`)
  if (link) {
    link.remove()
  }
}