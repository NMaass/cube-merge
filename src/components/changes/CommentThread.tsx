import { Comment, CommentResolution } from '../../types/firestore'
import { CommentItem } from '../comments/CommentItem'
import { CommentComposer } from '../comments/CommentComposer'

interface CommentThreadProps {
  comments: Comment[]
  onAddComment?: (body: string, resolution: CommentResolution) => void
  onSetResolution?: (commentId: string, resolution: CommentResolution) => void
  onEditComment?: (commentId: string, newBody: string) => void
  diffCards?: string[]
  reviewerNames?: string[]
  cardColors?: Record<string, string>
}

export function CommentThread({ comments, onAddComment, onSetResolution, onEditComment, diffCards, reviewerNames, cardColors }: CommentThreadProps) {
  return (
    <div className="mt-2 border-t border-slate-700 pt-2">
      {comments.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          onSetResolution={onSetResolution ? (res) => onSetResolution(comment.id, res) : undefined}
          onEdit={onEditComment ? (newBody) => onEditComment(comment.id, newBody) : undefined}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
          cardColors={cardColors}
        />
      ))}
      {onAddComment && (
        <CommentComposer
          onSubmit={onAddComment}
          diffCards={diffCards}
          reviewerNames={reviewerNames}
        />
      )}
    </div>
  )
}
