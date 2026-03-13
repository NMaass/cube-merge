import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'
import { initWebVitals, initPerformanceObserver } from './lib/webVitals'

function schedulePostPaintWork() {
  const run = () => {
    initWebVitals()
    initPerformanceObserver()
  }

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2000 })
    return
  }

  globalThis.setTimeout(run, 0)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>,
)

schedulePostPaintWork()
