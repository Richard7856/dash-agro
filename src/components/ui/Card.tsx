import React from 'react'

interface CardProps {
  variant?: 'raised' | 'inset' | 'flat' | 'green' | 'red'
  size?: 'sm' | 'md'
  onClick?: () => void
  className?: string
  children: React.ReactNode
}

export function Card({ variant = 'raised', size = 'md', onClick, className = '', children }: CardProps) {
  const variantClass = {
    raised: 'nm-card',
    inset:  'nm-inset',
    flat:   'bg-[var(--nm-bg)] rounded-[var(--nm-radius)]',
    green:  'nm-card-green',
    red:    'nm-card-red',
  }[variant]

  const sizeClass = size === 'sm' ? 'nm-card-sm' : ''

  const interactive = onClick
    ? 'cursor-pointer active:scale-[0.98] transition-transform'
    : ''

  return (
    <div
      className={`${variant === 'raised' && size === 'sm' ? 'nm-card-sm' : variantClass} p-4 ${interactive} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
