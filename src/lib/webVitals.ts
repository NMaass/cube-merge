// Core Web Vitals monitoring and reporting
import type { CLSMetric, FCPMetric, LCPMetric, TTFBMetric, Metric } from 'web-vitals'

interface VitalsData {
  name: string
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  timestamp: number
  url: string
}

// Store metrics for optional analytics reporting
const vitalsBuffer: VitalsData[] = []

function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  switch (name) {
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor'
    case 'INP':
      return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor'
    case 'FCP':
      return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor'
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
    case 'TTFB':
      return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor'
    default:
      return 'good'
  }
}

function logMetric(metric: CLSMetric | FCPMetric | LCPMetric | TTFBMetric | Metric) {
  const data: VitalsData = {
    name: metric.name,
    value: metric.value,
    rating: getRating(metric.name, metric.value),
    timestamp: Date.now(),
    url: window.location.href
  }
  
  vitalsBuffer.push(data)
  
  // Only log in development
  if (import.meta.env.DEV) {
    console.log(`[Web Vitals] ${data.name}: ${Math.round(data.value)}${data.name === 'CLS' ? '' : 'ms'} (${data.rating})`)
  }
  
  // Optional: Send to analytics service
  // sendToAnalytics(data)
}

export function initWebVitals() {
  // Dynamically import web-vitals to avoid loading it unnecessarily
  if (typeof window === 'undefined') return
  
  import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    onCLS(logMetric)
    onFCP(logMetric)
    onINP(logMetric)
    onLCP(logMetric)
    onTTFB(logMetric)
  }).catch(err => {
    if (import.meta.env.DEV) {
      console.warn('[Web Vitals] Failed to initialize:', err)
    }
  })
}

export function getVitalsData(): VitalsData[] {
  return [...vitalsBuffer]
}

// Performance observer for additional insights
export function initPerformanceObserver() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return
  
  try {
    // Monitor layout shifts beyond CLS
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          // Track individual layout shifts for debugging
          if (import.meta.env.DEV && (entry as any).value > 0.1) {
            console.warn('[Layout Shift]', 'Value:', (entry as any).value, 'Sources:', (entry as any).sources)
          }
        }
      }
    })
    
    observer.observe({ entryTypes: ['layout-shift'] })
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[Performance Observer] Failed to initialize:', err)
    }
  }
}

// Utility to measure custom performance marks
export function markPerformance(name: string) {
  if (typeof window !== 'undefined' && 'performance' in window) {
    performance.mark(name)
  }
}

export function measurePerformance(name: string, startMark: string, endMark?: string) {
  if (typeof window !== 'undefined' && 'performance' in window) {
    try {
      if (endMark) {
        performance.measure(name, startMark, endMark)
      } else {
        performance.measure(name, startMark)
      }
      
      const measure = performance.getEntriesByName(name, 'measure')[0]
      if (import.meta.env.DEV && measure) {
        console.log(`[Performance] ${name}: ${Math.round(measure.duration)}ms`)
      }
      return measure?.duration
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn(`[Performance] Failed to measure ${name}:`, err)
      }
    }
  }
  return undefined
}
