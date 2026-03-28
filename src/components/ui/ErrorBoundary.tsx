import { Component, ReactNode, ErrorInfo } from 'react'
import { captureException } from '../../lib/errorReporting'
import { Button } from './Button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    void captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } })

    if (!import.meta.env.PROD) {
      console.error('Error caught by boundary:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <h2 className="text-xl font-semibold text-red-400">Something went wrong</h2>
            <p className="text-slate-400 text-sm">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            {import.meta.env.DEV ? (
              <details className="text-left">
                <summary className="cursor-pointer text-blue-400 hover:text-blue-300 transition-colors text-sm">
                  Error details
                </summary>
                <pre className="text-xs text-slate-500 mt-2 p-3 bg-slate-800 rounded overflow-auto max-h-32 text-left">
                  {this.state.error?.stack}
                </pre>
              </details>
            ) : (
              <p className="text-xs text-slate-500">
                The error was captured for debugging when monitoring is enabled.
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={() => window.location.reload()}>
                Reload page
              </Button>
              <Button
                variant="secondary"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              >
                Try again
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
