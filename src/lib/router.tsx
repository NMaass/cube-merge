import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'

type NavigateOptions = {
  replace?: boolean
  state?: unknown
}

type RouterLocation = {
  pathname: string
  search: string
  hash: string
  state: unknown
}

type RouterContextValue = {
  location: RouterLocation
  navigate: (to: string, options?: NavigateOptions) => void
  params: Record<string, string>
}

type RouteMatch = {
  params: Record<string, string>
}

type RouteDefinition = {
  path: string
  element: React.ReactNode
}

const RouterContext = createContext<RouterContextValue | null>(null)

function getCurrentLocation(): RouterLocation {
  return {
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    state: window.history.state,
  }
}

function matchPath(pattern: string, pathname: string): RouteMatch | null {
  if (pattern === '*') return { params: {} }

  const patternParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)

  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}

  for (let index = 0; index < patternParts.length; index += 1) {
    const patternPart = patternParts[index]
    const pathPart = pathParts[index]

    if (patternPart.startsWith(':')) {
      params[patternPart.slice(1)] = decodeURIComponent(pathPart)
      continue
    }

    if (patternPart !== pathPart) return null
  }

  return { params }
}

export function RouterProvider({
  routes,
}: {
  routes: RouteDefinition[]
}) {
  const [location, setLocation] = useState<RouterLocation>(() => getCurrentLocation())

  useEffect(() => {
    const handleLocationChange = () => {
      setLocation(getCurrentLocation())
    }

    window.addEventListener('popstate', handleLocationChange)
    return () => window.removeEventListener('popstate', handleLocationChange)
  }, [])

  const navigate = (to: string, options?: NavigateOptions) => {
    const method = options?.replace ? 'replaceState' : 'pushState'
    window.history[method](options?.state ?? null, '', to)
    setLocation(getCurrentLocation())
  }

  const matchedRoute = useMemo(() => {
    for (const route of routes) {
      const match = matchPath(route.path, location.pathname)
      if (match) return { route, params: match.params }
    }

    return null
  }, [location.pathname, routes])

  const value = useMemo<RouterContextValue>(() => ({
    location,
    navigate,
    params: matchedRoute?.params ?? {},
  }), [location, matchedRoute])

  return (
    <RouterContext.Provider value={value}>
      {matchedRoute?.route.element ?? null}
    </RouterContext.Provider>
  )
}

function useRouterContext() {
  const context = useContext(RouterContext)
  if (!context) throw new Error('Router hooks must be used within RouterProvider')
  return context
}

export function useNavigate() {
  return useRouterContext().navigate
}

export function useParams<T extends Record<string, string | undefined>>() {
  return useRouterContext().params as T
}

export function useLocation() {
  return useRouterContext().location
}

export function useSearchParams() {
  const { search } = useLocation()
  return useMemo(() => [new URLSearchParams(search)] as const, [search])
}

export function Link({
  to,
  replace,
  state,
  onClick,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  to: string
  replace?: boolean
  state?: unknown
}) {
  const navigate = useNavigate()

  return (
    <a
      {...props}
      href={to}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === '_blank'
        ) {
          return
        }

        event.preventDefault()
        navigate(to, { replace, state })
      }}
    />
  )
}
