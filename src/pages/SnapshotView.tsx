import { useEffect, useState } from 'react'
import { useParams, Link } from '../lib/router'
import { Helmet } from 'react-helmet-async'
import { doc, getDoc } from 'firebase/firestore/lite'
import { db } from '../lib/firebase-lite'
import { Snapshot } from '../types/firestore'
import { Spinner } from '../components/ui/Spinner'
import { EditModeProvider } from '../context/EditModeContext'
import { ReviewWorkspace } from './NewReviewPage'

export default function SnapshotView() {
  const { snapshotId } = useParams<{ snapshotId: string }>()
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!snapshotId) return
    getDoc(doc(db, 'snapshots', snapshotId)).then(snap => {
      if (snap.exists()) setSnapshot({ id: snap.id, ...snap.data() } as Snapshot)
      setLoading(false)
    })
  }, [snapshotId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-300 text-lg">Snapshot not found</p>
          <Link to="/" className="text-blue-400 hover:text-blue-300 text-sm">← Go home</Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>{snapshot.title} — Cube Diff</title>
        <meta name="description" content={`${snapshot.changes.length} card changes between ${snapshot.cubeAId} and ${snapshot.cubeBId}. Reviewed with Cube Diff.`} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={`${snapshot.title} — Cube Diff`} />
        <meta property="og:description" content={`${snapshot.changes.length} card changes reviewed — ${snapshot.cubeAId} vs ${snapshot.cubeBId}`} />
        <meta property="og:url" content={`${window.location.origin}/${snapshotId}`} />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={`${snapshot.title} — Cube Diff`} />
        <meta name="twitter:description" content={`${snapshot.changes.length} card changes reviewed`} />
        <link rel="canonical" href={`${window.location.origin}/${snapshotId}`} />
      </Helmet>
      <EditModeProvider>
        <ReviewWorkspace
          cubeAId={snapshot.cubeAId}
          cubeBId={snapshot.cubeBId}
          diffData={snapshot.rawData}
          initialChanges={snapshot.changes}
          parentSnapshotId={snapshot.id}
        />
      </EditModeProvider>
    </>
  )
}
