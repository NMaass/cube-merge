import { Timestamp } from 'firebase/firestore'
import { CubeCard } from './cube'

export interface Draft {
  id: string
  ownerId: string
  ownerName: string
  ownerPhotoURL: string
  cubeAId: string
  cubeBId: string
  title: string
  parentSnapshotId?: string
  rawData: {
    onlyA: CubeCard[]
    onlyB: CubeCard[]
  }
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type ChangeType = 'add' | 'remove' | 'swap' | 'keep' | 'reject'
export type CommentResolution = 'none' | 'blocking' | 'resolved'

export interface Change {
  id: string
  type: ChangeType
  cardsIn: CubeCard[]
  cardsOut: CubeCard[]
  initialComment: string
  authorId: string
  authorName: string
  authorPhotoURL: string
  unresolved?: boolean
  createdAt: Timestamp
}

export interface Comment {
  id: string
  body: string
  authorId: string
  authorName: string
  authorPhotoURL: string
  resolution: CommentResolution
  createdAt: Timestamp
}

// ── Reviews (new persistent collaborative model) ────────────────────────────

export interface Review {
  id: string
  cubeAId: string
  cubeBId: string
  title: string
  rawData: {
    onlyA: CubeCard[]
    onlyB: CubeCard[]
  }
  createdAt: Timestamp
  parentReviewId?: string
}

export interface LiveChange {
  id: string
  type: ChangeType
  cardsIn: CubeCard[]
  cardsOut: CubeCard[]
  initialComment: string
  authorId: string
  authorName: string
  authorPhotoURL: string
  unresolved?: boolean
  createdAt: Timestamp
  comments: Comment[]
  updatedAt?: Timestamp
  updatedBy?: string
  updatedByName?: string
  deletedAt?: Timestamp
  deletedBy?: string
  deletedByName?: string
}

export type ReviewEventType = 'change_created' | 'change_edited' | 'change_deleted'

export interface ReviewEvent {
  id: string
  type: ReviewEventType
  changeId: string
  authorId: string
  authorName: string
  createdAt: Timestamp
  payload: {
    change?: LiveChange
    before?: LiveChange
    after?: LiveChange
  }
}

export interface Session {
  key: string
  authorId: string
  authorName: string
  startTime: Timestamp
  endTime: Timestamp
  events: ReviewEvent[]
}

export interface Snapshot {
  id: string
  sourceReviewId: string
  parentSnapshotId?: string
  ownerId: string
  ownerName: string
  ownerPhotoURL: string
  frozenAt: Timestamp
  cubeAId: string
  cubeBId: string
  title: string
  rawData: {
    onlyA: CubeCard[]
    onlyB: CubeCard[]
  }
  changes: Array<Change & { comments: Comment[] }>
}
