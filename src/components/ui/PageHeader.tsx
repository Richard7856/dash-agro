import { Btn } from './Btn'

interface PageHeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-xl font-bold text-[var(--nm-text)]">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <Btn
          variant="primary"
          size="sm"
          onClick={action.onClick}
          className="hidden md:inline-flex gap-1.5"
        >
          <span className="text-lg leading-none">+</span>
          {action.label}
        </Btn>
      )}
    </div>
  )
}
