import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import React, { Suspense, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import { loadFirestoreImageCache } from './lib/imageCache'
import { ErrorBoundary } from './components/ui/ErrorBoundary'

const LandingPage = React.lazy(() => import('./pages/LandingPage'))
const ReviewPage = React.lazy(() => import('./pages/ReviewPage'))
const ChangelogPage = React.lazy(() => import('./pages/ChangelogPage'))
const SnapshotView = React.lazy(() => import('./pages/SnapshotView'))

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/review/:reviewId', element: <ReviewPage /> },
  { path: '/review/:reviewId/changelog', element: <ChangelogPage /> },
  { path: '/new', element: <Navigate to="/" replace /> },
  { path: '/r/:snapshotId', element: <SnapshotView /> },
  { path: '/:snapshotId', element: <SnapshotView /> },
])

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-500 text-sm">Loading…</span>
      </div>
    </div>
  )
}

function App() {
  useEffect(() => { loadFirestoreImageCache() }, [])

  return (
    <ErrorBoundary>
      <AuthProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:outline-none"
        >
          Skip to main content
        </a>
        <Suspense fallback={<LoadingScreen />}>
          <RouterProvider router={router} />
        </Suspense>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
