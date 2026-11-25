import { Button } from './Button'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mt-8 text-center">
      <p role="alert" className="text-content text-body">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-3">
          다시 시도
        </Button>
      )}
    </div>
  )
}
