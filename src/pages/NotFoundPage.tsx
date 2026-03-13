import { Helmet } from 'react-helmet-async'
import { Link } from '../lib/router'
import { Button } from '../components/ui/Button'

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found — Cube Merge</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="min-h-screen bg-slate-900 px-4 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300/80">404</p>
            <h1 className="text-3xl font-semibold text-white">That page doesn&apos;t exist.</h1>
            <p className="text-sm text-slate-400">
              The link may be incomplete, expired, or copied from an older route.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/">
              <Button>Start a review</Button>
            </Link>
            <Button variant="secondary" onClick={() => window.history.back()}>
              Go back
            </Button>
          </div>
        </div>
      </main>
    </>
  )
}
