import { useEffect, useState } from 'react'
import { Badge } from './Badge'
import type { BuildInfo } from '../../types/build-info'

interface BuildInfoDisplayProps {
  isOpen: boolean
}

export function BuildInfoDisplay({ isOpen }: BuildInfoDisplayProps) {
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)

  useEffect(() => {
    if (import.meta.env.MODE === 'development') {
      setBuildInfo({
        version: '1.0.0-dev',
        environment: 'development',
        git: {
          branch: 'local',
          commitHash: '0000000000000000000000000000000000000000',
          shortHash: '0000000',
          isDirty: true,
        },
        timestamp: {
          iso: new Date().toISOString(),
          unix: Math.floor(Date.now() / 1000),
          formatted: {
            utc: new Date().toUTCString(),
            est: new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }),
            pst: new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }),
          },
        },
        builder: {
          node: 'local',
          platform: 'local',
          arch: 'local',
        },
      })
      return
    }

    fetch('/build-info.json')
      .then(res => res.json())
      .then(data => setBuildInfo(data))
      .catch(() => { /* silently skip */ })
  }, [])

  if (!isOpen || !buildInfo) return null

  const envVariant: Record<string, 'green' | 'yellow' | 'red' | 'blue'> = {
    production: 'red',
    staging: 'yellow',
    development: 'green',
    ci: 'blue',
  }
  const variant = envVariant[buildInfo.environment] ?? 'green'
  const envLabel = buildInfo.environment === 'development' && import.meta.env.MODE === 'development'
    ? 'Development (local)'
    : buildInfo.environment.charAt(0).toUpperCase() + buildInfo.environment.slice(1)

  return (
    <div className="border-t border-slate-700 pt-4 mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Badge variant={variant}>{envLabel}</Badge>

        {/* Branch */}
        <span className="flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="6" y1="3" x2="6" y2="15"/>
            <circle cx="18" cy="6" r="3"/>
            <circle cx="6" cy="18" r="3"/>
            <path d="M18 9a9 9 0 0 1-9 9"/>
          </svg>
          {buildInfo.git.branch}
        </span>

        {/* Commit */}
        <span className="flex items-center gap-1 font-mono">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <line x1="3" y1="12" x2="9" y2="12"/>
            <line x1="15" y1="12" x2="21" y2="12"/>
          </svg>
          {buildInfo.git.shortHash}
        </span>

        {buildInfo.git.isDirty && (
          <Badge variant="yellow">Modified</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-400">
        <div><span className="text-slate-500">Version:</span> {buildInfo.version}</div>
        <div><span className="text-slate-500">Full hash:</span> <span className="font-mono">{buildInfo.git.commitHash.substring(0, 12)}…</span></div>
        <div><span className="text-slate-500">Node:</span> {buildInfo.builder.node}</div>
        <div><span className="text-slate-500">Platform:</span> {buildInfo.builder.platform}/{buildInfo.builder.arch}</div>
      </div>

      <div className="space-y-1 text-xs text-slate-400">
        <div className="text-slate-500 font-medium">Build time</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <div><span className="text-slate-500">UTC:</span> {buildInfo.timestamp.formatted.utc}</div>
          <div><span className="text-slate-500">EST:</span> {buildInfo.timestamp.formatted.est}</div>
          <div><span className="text-slate-500">PST:</span> {buildInfo.timestamp.formatted.pst}</div>
          <div><span className="text-slate-500">Unix:</span> {buildInfo.timestamp.unix}</div>
        </div>
      </div>
    </div>
  )
}
