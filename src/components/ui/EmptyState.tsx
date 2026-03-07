import { Btn } from './Btn'

interface EmptyStateProps {
  message: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="nm-inset w-14 h-14 flex items-center justify-center mb-3">
        <svg className="w-7 h-7 text-[var(--nm-text-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <p className="text-[var(--nm-text-muted)] text-sm">{message}</p>
      {action && (
        <Btn variant="primary" size="sm" onClick={action.onClick} className="mt-3">
          {action.label}
        </Btn>
      )}
    </div>
  )
}
