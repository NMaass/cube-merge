let sentryPromise: Promise<typeof import('@sentry/react') | null> | null = null
let sentryInitialized = false

function isSentryEnabled() {
  return import.meta.env.PROD && Boolean(import.meta.env.VITE_SENTRY_DSN)
}

async function loadSentry() {
  if (!isSentryEnabled()) return null

  if (!sentryPromise) {
    sentryPromise = import('@sentry/react')
      .then((Sentry) => {
        if (!sentryInitialized) {
          const integrations = []

          if (import.meta.env.VITE_SENTRY_ENABLE_TRACING === 'true') {
            integrations.push(Sentry.browserTracingIntegration())
          }

          if (import.meta.env.VITE_SENTRY_ENABLE_REPLAY === 'true') {
            integrations.push(Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }))
          }

          Sentry.init({
            dsn: import.meta.env.VITE_SENTRY_DSN,
            enabled: true,
            integrations,
            tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACE_SAMPLE_RATE ?? 0),
            replaysSessionSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE ?? 0),
            replaysOnErrorSampleRate: Number(import.meta.env.VITE_SENTRY_REPLAY_ERROR_SAMPLE_RATE ?? 0),
          })
          sentryInitialized = true
        }

        return Sentry
      })
      .catch((error) => {
        console.error('Failed to initialize Sentry:', error)
        return null
      })
  }

  return sentryPromise
}

export async function captureException(error: unknown, context?: Record<string, unknown>) {
  const Sentry = await loadSentry()

  if (Sentry) {
    Sentry.captureException(error, context)
    return
  }

  console.error('Captured exception:', error, context)
}
