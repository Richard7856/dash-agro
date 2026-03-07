interface SpinnerProps {
  color?: 'green' | 'red' | 'yellow'
  size?: 'sm' | 'md'
  fullPage?: boolean
}

export function Spinner({ color = 'green', size = 'md', fullPage = false }: SpinnerProps) {
  const colorClass = {
    green:  'border-green-600',
    red:    'border-red-500',
    yellow: 'border-yellow-500',
  }[color]

  const sizeClass = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'

  const spinner = (
    <div className={`${sizeClass} border-4 ${colorClass} border-t-transparent rounded-full animate-spin`} />
  )

  if (fullPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {spinner}
      </div>
    )
  }

  return (
    <div className="flex justify-center py-10">
      {spinner}
    </div>
  )
}
