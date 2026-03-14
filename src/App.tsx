import React, { Suspense, useEffect } from 'react'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { WebApplicationStructuredData } from './components/seo/StructuredData'
import { AuthProvider } from './context/AuthContext'
import { loadFirestoreImageCache } from './lib/imageCache'
import { RouterProvider, useNavigate, useParams } from './lib/router'
import LandingPage from './pages/LandingPage'
import NotFoundPage from './pages/NotFoundPage'

const ReviewPage = React.lazy(() => import('./pages/ReviewPage'))
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage'))
const SnapshotView = React.lazy(() => import('./pages/SnapshotView'))

function ReviewRedirect({ changelog }: { changelog?: boolean }) {
  const { reviewId } = useParams<{ reviewId: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!reviewId) return
    navigate(changelog ? `/c/${reviewId}/changelog` : `/c/${reviewId}`, { replace: true })
  }, [changelog, navigate, reviewId])

  return null
}

function HomeRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/', { replace: true })
  }, [navigate])

  return null
}

const routes = [
  { path: '/', element: <LandingPage /> },
  { path: '/c/:reviewId', element: <ReviewPage /> },
  { path: '/c/:reviewId/changelog', element: <ChangelogPage /> },
  { path: '/review/:reviewId', element: <ReviewRedirect /> },
  { path: '/review/:reviewId/changelog', element: <ReviewRedirect changelog /> },
  { path: '/new', element: <HomeRedirect /> },
  { path: '/r/:snapshotId', element: <SnapshotView /> },
  { path: '/:snapshotId', element: <SnapshotView /> },
  { path: '*', element: <NotFoundPage /> },
]

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"
          role="status"
          aria-label="Loading application"
        />
        <span className="text-slate-400 text-sm">Loading…</span>
      </div>
    </div>
  )
}

function App() {
  useEffect(() => {
    const warmCache = () => {
      void loadFirestoreImageCache()
    }

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(warmCache, { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }

    const timeoutId = globalThis.setTimeout(warmCache, 250)
    return () => globalThis.clearTimeout(timeoutId)
  }, [])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <WebApplicationStructuredData />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-amber-500 focus:text-slate-900 focus:rounded-lg focus:text-sm focus:outline-none"
        >
          Skip to main content
        </a>
        <div id="main-content">
          <Suspense fallback={<LoadingScreen />}>
            <RouterProvider routes={routes} />
          </Suspense>
        </div>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
